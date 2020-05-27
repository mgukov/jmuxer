import * as debug from '../util/debug';
import {H264Parser} from '../parsers/h264.js';
import {BaseRemuxer, Mp4Sample} from './base.js';
import {MediaFrames, TrackType} from "../controller/remux";
import {NALU} from "../util/nalu";




export class H264Remuxer extends BaseRemuxer {

  private nextDts = 0;
  protected timescale = 1000;
  private h264: H264Parser;

  private init = false;

  constructor(pts: number) {
    super({
      id: BaseRemuxer.getTrackID(),
      type: TrackType.Video,
      len: 0,
      fragmented: true,
      width: 0,
      height: 0,
      timescale: 1000,
      duration: 1000,
      samples: [],
    }, pts);
    this.nextDts = pts;
    this.h264 = new H264Parser(this);
  }

  resetTrack() {
    this.readyToDecode = false;
    this.mp4track.sps = [];
    this.mp4track.pps = [];
  }

  remux(samples: MediaFrames[], pts?: number) {
    if (!this.init) {
      this.init = true;
      if (pts) {
        this.nextDts = pts;
        this.dts = pts;
      }
    }

    for (const sample of samples) {
      const units:NALU[] = [];
      let size = 0;
      let keyFrame = false;
      for (const unit of (sample.units as NALU[])) {
        if (this.h264.parseNAL(unit)) {
          units.push(unit);
          size += unit.getSize();
          if (!keyFrame) {
            keyFrame = unit.isKeyframe();
          }
        }
      }

      if (units.length > 0 && this.readyToDecode) {
        this.mp4track.len += size;
        this.samples.push({
          units: units,
          size: size,
          keyFrame: keyFrame,
          duration: sample.duration,
        });
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
          paddingValue: 0, // undefined

          isLeading: 0,
          isDependedOn: 0,
          hasRedundancy: 0,
          degradPrio: 0,
          isNonSync: sample.keyFrame ? 0 : 1,
          dependsOn: sample.keyFrame ? 2 : 1,
        },
      };

      for (const unit of (units as NALU[])) {
        payload.set(unit.getData(), offset);
        offset += unit.getSize();
      }

      samples.push(mp4Sample);
    }

    if (!samples.length) return null;

    return new Uint8Array(payload.buffer, 0, this.mp4track.len);
  }
}
