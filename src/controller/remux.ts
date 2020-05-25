import * as debug from '../util/debug';
import { MP4 } from '../util/mp4-generator.js';
import { AACRemuxer } from '../remuxer/aac.js';
import { H264Remuxer } from '../remuxer/h264.js';
import { appendByteArray, secToTime } from '../util/utils.js';
import {Event} from '../util/event';
import {BaseRemuxer} from "../remuxer/base";

export enum TrackType {
    Both = 'both',
    Video = 'video',
    Audio = 'audio'
}

export class VideoChunks {
    video:any[] = [];
    audio:any[] = [];
    [Key: string]: number[]
}


export default class RemuxController extends Event {

    private initialized = false;
    private trackTypes:TrackType[] = [];
    // private tracks = {};
    private mediaDuration:number;

    readonly tracks = new Map<TrackType, BaseRemuxer>();

    constructor(streaming:boolean) {
        super('remuxer');
        this.mediaDuration = streaming ? Infinity : 1000;
    }

    addTrack(type:TrackType) {
        if (type === TrackType.Video || type === TrackType.Both) {
            this.tracks.set(TrackType.Video, new H264Remuxer());
            this.trackTypes.push(TrackType.Video);
        }
        if (type === 'audio' || type === TrackType.Both) {
            this.tracks.set(TrackType.Audio, new AACRemuxer());
            this.trackTypes.push(TrackType.Audio);
        }
    }

    reset() {
        for (let type of this.trackTypes) {
            const remuxer = this.tracks.get(type);
            if (remuxer) {
                remuxer.resetTrack();
            }
        }
        this.initialized = false;
    }

    destroy() {
        this.tracks.clear();
        this.offAll();
    }

    flush() {
        if (!this.initialized) {
            if (this.isReady()) {
                this.dispatch('ready');
                for (let type of this.trackTypes) {
                    let track = this.tracks.get(type);
                    if (track) {
                        let data = {
                            type: type,
                            payload: MP4.initSegment([track.mp4track], this.mediaDuration, track.mp4track.timescale),
                        };
                        this.dispatch('buffer', data);
                    }
                }
                debug.log('Initial segment generated.');
                this.initialized = true;
            }
        } else {
            for (let type of this.trackTypes) {
                let track = this.tracks.get(type);
                if (track) {
                    let pay = track.getPayload();
                    if (pay && pay.byteLength) {
                        const moof = MP4.moof(track.seq, track.dts, track.mp4track);
                        const mdat = MP4.mdat(pay);
                        let payload = appendByteArray(moof, mdat);
                        let data = {
                            type: type,
                            payload: payload,
                            dts: track.dts
                        };
                        this.dispatch('buffer', data);
                        let duration = secToTime(track.dts / 1000);
                        debug.log(`put segment (${type}): ${track.seq} dts: ${track.dts} samples: ${track.mp4track.samples.length} second: ${duration}`);
                        track.flush();
                    }
                }
            }
        }
    }

    isReady() {
        for (const type of this.trackTypes) {

            const track = this.tracks.get(type);
            if (track && (!track.readyToDecode || track.samples.length === 0)) {
                return false;
            }
        }
        return true;
    }

    remux(data:VideoChunks) {
        for (let type of this.trackTypes) {

            let samples = data[type];
            if (type === 'audio') {
                const track = this.tracks.get(type);
                if (track && !track.readyToDecode) {
                    continue; /* if video is present, don't add audio until video get ready */
                }
            }

            if (samples.length > 0) {
                const track = this.tracks.get(type);
                if (track) {
                    track.remux(samples);
                }
            }
        }
        this.flush();
    }
}
