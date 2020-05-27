import {MediaFrames, TrackType} from "../controller/remux";

let track_id = 1;

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

    seq = 1;
    readonly mp4track: Track;
    readyToDecode = false;
    samples:any[] = [];
    isHDAvail = false;
    dts:number;

    static getTrackID() {
        return track_id++;
    }

    protected constructor(track: Track, pts:number) {
        this.mp4track = track;
        this.dts = pts;
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
    }


}
