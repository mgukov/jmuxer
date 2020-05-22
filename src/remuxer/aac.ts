import * as debug from '../util/debug';
import {AACParser} from '../parsers/aac.js';
import {BaseRemuxer} from './base.js';
import {TrackType} from "../controller/remux";

export class AACRemuxer extends BaseRemuxer {

    nextDts = 0;
    timescale = 1000;

    private readonly aac: AACParser;

    constructor() {
        super({
            id: BaseRemuxer.getTrackID(),
            type: TrackType.Audio,
            channelCount: 0,
            len: 0,
            fragmented: true,
            timescale: 1000,
            duration: 1000,
            samples: []
        });
        this.aac = new AACParser(this);
    }

    resetTrack() {
        this.readyToDecode = false;
        this.mp4track.codec = undefined;
        this.mp4track.channelCount = undefined;
        this.mp4track.config = undefined;
        this.mp4track.timescale = this.timescale;
    }

    remux(samples:any[]) {
        let config,
            sample,
            size,
            payload;
        for (let sample of samples) {
            payload = sample.units;
            size = payload.byteLength;
            this.samples.push({
                units: payload,
                size: size,
                duration: sample.duration,
            });
            this.mp4track.len += size;
            if (!this.readyToDecode) {
                this.aac.setAACConfig();
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
        let mp4Sample,
            duration;

        this.dts = this.nextDts;

        while (this.samples.length) {
            let sample = this.samples.shift(),
                units = sample.units;

            duration = sample.duration;

            if (duration <= 0) {
                debug.log(`remuxer: invalid sample duration at DTS: ${this.nextDts} :${duration}`);
                this.mp4track.len -= sample.size;
                continue;
            }

            this.nextDts += duration;
            mp4Sample = {
                size: sample.size,
                duration: duration,
                cts: 0,
                flags: {
                    isLeading: 0,
                    isDependedOn: 0,
                    hasRedundancy: 0,
                    degradPrio: 0,
                    dependsOn: 1,
                },
            };

            payload.set(sample.units, offset);
            offset += sample.size;
            samples.push(mp4Sample);
        }

        if (!samples.length) return null;

        return new Uint8Array(payload.buffer, 0, this.mp4track.len);
    }
}
