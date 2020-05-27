import * as debug from '../util/debug';
import {AACParser, AudioParser} from '../parsers/aac.js';
import {BaseRemuxer, Mp4Sample} from './base.js';
import {MediaFrames, TrackType} from "../controller/remux";
import {OpusParser} from "../parsers/opus";

export class AudioRemuxer extends BaseRemuxer {

    nextDts = 0;
    timescale = 1000;

    private readonly parser: AudioParser;

    constructor(pts:number) {
        super({
            id: BaseRemuxer.getTrackID(),
            type: TrackType.Audio,
            channelCount: 0,
            len: 0,
            fragmented: true,
            timescale: 1000,
            duration: 1000,
            samples: []
        }, pts);
        this.nextDts = pts;
        this.parser = new OpusParser(this);
    }

    resetTrack() {
        this.readyToDecode = false;
        this.mp4track.codec = undefined;
        this.mp4track.channelCount = undefined;
        this.mp4track.config = undefined;
        this.mp4track.timescale = this.timescale;
    }

    remux(samples:MediaFrames[], pts?:number) {
        for (let sample of samples) {
            const payload = sample.units as Uint8Array;
            const size = payload.byteLength;
            this.samples.push({
                units: payload,
                size: size,
                duration: sample.duration,
                keyFrame: false
            });
            this.mp4track.len += size;
            if (!this.readyToDecode) {
                this.parser.setConfig();
            }
        }
    }

    getPayload() {
        if (!this.isReady()) {
            return null;
        }

        let payload = new Uint8Array(this.mp4track.len);
        let offset = 0;
        let samples = this.mp4track.samples;

        this.dts = this.nextDts;

        while (this.samples.length) {
            const sample = this.samples.shift();
            if (!sample) {
                break;
            }

            const units = sample.units;
            const duration = sample.duration;
            if (duration <= 0) {
                debug.log(`remuxer: invalid sample duration at DTS: ${this.nextDts} :${duration}`);
                this.mp4track.len -= sample.size;
                continue;
            }

            this.nextDts += duration;
            const mp4Sample:Mp4Sample = {
                size: sample.size,
                duration: duration,
                cts: 0,
                flags: {
                    paddingValue:0,
                    isNonSync:0,

                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: 1,
                },
            };

            payload.set((sample.units as Uint8Array), offset);
            offset += sample.size;
            samples.push(mp4Sample);
        }

        if (!samples.length) return null;

        return new Uint8Array(payload.buffer, 0, this.mp4track.len);
    }
}
