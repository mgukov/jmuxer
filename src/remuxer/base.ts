import {MediaFrames, TrackType} from "../controller/remux";
import {NALU} from "../util/nalu";
import * as debug from '../util/debug';

let track_id = 1;

export type Sample = {
    units: NALU[]|Uint8Array,
    size: number,
    keyFrame: boolean,
    duration: number,

};

export type Mp4Sample = {
    size: number,
    duration: number,
    cts: number,
    flags: {
        isLeading: number,
        isDependedOn: number,
        hasRedundancy: number,
        degradPrio: number,
        isNonSync: number,
        dependsOn: number,
        paddingValue: number
    }
};

export type Track = {
    id: number;
    type: TrackType.Video|TrackType.Audio;
    len: number;
    fragmented: boolean;
    sps?: Uint8Array[];
    pps?: Uint8Array[];
    width?: number;
    height?: number;
    timescale: number;
    duration: number;
    samples:Mp4Sample[];

    codec?: string;
    channelCount?: number;
    config?: Uint8Array;
    volume?:number;
    audiosamplerate?:number;
};

export class BaseRemuxer {
    readonly mp4track: Track;
    samples:Sample[] = [];

    readyToDecode = false;
    isHDAvail = false;
    seq = 1;
    dts = -1;
    nextDts = -1;

    static getTrackID() {
        return track_id++;
    }

    protected constructor(track: Track) {
        this.mp4track = track;
    }

    flush() {
        this.seq++;
        this.mp4track.len = 0;
        this.mp4track.samples = [];
    }

    isReady() {
        return this.readyToDecode && this.samples.length > 0;
    }

    resetTrack() {}

    getPayload():Uint8Array|null {
        return null;
    }

    remux(samples:MediaFrames[], pts?:number) {
        if (pts != null && this.dts === -1) {
            this.dts = pts;
            this.nextDts = pts;
        }

        if (pts != null && this.nextDts != pts) {
            debug.log('pts diff = ' + (this.nextDts - pts));
        }
    }
}
