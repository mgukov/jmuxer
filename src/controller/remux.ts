import * as debug from '../util/debug';
import { MP4 } from '../util/mp4-generator';
import { H264Remuxer } from '../remuxer/h264';
import {Utils} from '../util/utils';
import {Event} from '../util/event';
import {BaseRemuxer} from "../remuxer/base";
import {NALU} from "../util/nalu";
import {AudioRemuxer} from "../remuxer/audio";
import {Mp4} from "../util/mp4";

export enum TrackType {
    Both = 'both',
    Video = 'video',
    Audio = 'audio'
}

export type MediaFrames = {
    units: NALU[] | Uint8Array,
    duration:number;
};

export class MediaChunks {
    video:MediaFrames[] = [];
    audio:MediaFrames[] = [];
    pts?:number;

    get(type:TrackType) {
        return type === TrackType.Video ? this.video : this.audio;
    }
}


export default class RemuxController extends Event {

    private initialized = false;
    private trackTypes:TrackType[] = [];
    private readonly mediaDuration:number;
    readonly muxers = new Map<TrackType, BaseRemuxer>();

    constructor(streaming:boolean) {
        super('remuxer');
        this.mediaDuration = streaming ? Infinity : 1000;
    }

    addTrack(type:TrackType) {
        if (type === TrackType.Video || type === TrackType.Both) {
            this.muxers.set(TrackType.Video, new H264Remuxer(0));
            this.trackTypes.push(TrackType.Video);
        }
        if (type === TrackType.Audio || type === TrackType.Both) {
            this.muxers.set(TrackType.Audio, new AudioRemuxer(0));
            this.trackTypes.push(TrackType.Audio);
        }
    }

    reset() {
        for (let type of this.trackTypes) {
            const muxer = this.muxers.get(type);
            if (muxer) {
                muxer.resetTrack();
            }
        }
        this.initialized = false;
    }

    destroy() {
        this.muxers.clear();
        this.offAll();
    }

    private flush() {
        if (!this.initialized) {
            if (this.isReady()) {
                this.dispatch('ready');
                for (let type of this.trackTypes) {
                    let track = this.muxers.get(type);
                    if (track) {
                        let data = {
                            type: type,
                            payload: Mp4.initSegment([track.mp4track], this.mediaDuration, track.mp4track.timescale),
                        };
                        this.dispatch('buffer', data);
                    }
                }
                debug.log('Initial segment generated.');
                this.initialized = true;
            }
        } else {
            for (let type of this.trackTypes) {
                let muxer = this.muxers.get(type);
                if (muxer) {
                    let pay = muxer.getPayload();
                    if (pay && pay.byteLength) {
                        const moof = Mp4.moof(muxer.seq, muxer.dts, muxer.mp4track);

                        // console.log(JSON.stringify(moof.dump()));

                        const mdat = Mp4.mdat(pay);
                        let payload = Utils.appendByteArray(moof.getData(), mdat.getData());
                        let data = {
                            type: type,
                            payload: payload,
                            dts: muxer.dts
                        };
                        this.dispatch('buffer', data);
                        let duration = Utils.secToTime(muxer.dts / 1000);
                        debug.log(`put segment (${type}): ${muxer.seq} dts: ${muxer.dts} samples: ${muxer.mp4track.samples.length} second: ${duration}`);
                        muxer.flush();
                    }
                }
            }
        }
    }

    isReady() {
        for (const type of this.trackTypes) {
            const muxer = this.muxers.get(type);
            if (muxer && !muxer.isReady()) {
                return false;
            }
        }
        return true;
    }

    remux(data:MediaChunks) {
        for (let type of this.trackTypes) {

            let samples = data.get(type);
            if (type === TrackType.Audio) {
                const muxer = this.muxers.get(TrackType.Video);
                if (muxer && !muxer.readyToDecode) {
                    continue; /* if video is present, don't add audio until video get ready */
                }
            }

            if (samples.length > 0) {
                const muxer = this.muxers.get(type);
                if (muxer) {
                    muxer.remux(samples, data.pts);
                }
            }
        }
        this.flush();
    }
}
