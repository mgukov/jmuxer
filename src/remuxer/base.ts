import * as debug from '../util/debug';
import {TrackType} from "../controller/remux";

let track_id = 1;


export type Track = {
    id: number;
    type: TrackType.Video|TrackType.Audio;
    len: number;
    fragmented: boolean;
    sps?: any;
    pps?: any;
    width?: number;
    height?: number;
    timescale: number;
    duration: number;
    samples:any[];

    codec?: string;
    channelCount?: number;
    config?: Uint8Array;
};


export class BaseRemuxer {

    seq = 1;
    readonly mp4track: Track;
    readyToDecode = false;
    samples:any[] = [];
    isHDAvail = false;
    dts = 0;

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
        if (!this.readyToDecode || !this.samples.length) return null;
        return true;
    }

    resetTrack() {}

    getPayload():Uint8Array|null {
        return null;
    }

    remux(samples:any[]) {
    }
}
