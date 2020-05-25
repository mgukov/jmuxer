import * as debug from '../util/debug';
import {BaseRemuxer, Track} from "../remuxer/base";
import {AudioParser} from "./aac";

let opusHeader:Uint8Array;

export class OpusParser extends AudioParser {

    static get samplingRateMap() {
        return [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    }

    static get getOpusHeaderData() {
        return opusHeader;
    }

    static getHeaderLength(data:Uint8Array) {
        return (data[1] & 0x01 ? 7 : 9);  // without CRC 7 and with CRC 9 Refs: https://wiki.multimedia.cx/index.php?title=ADTS
    }

    static getFrameLength(data:Uint8Array) {
        return ((data[3] & 0x03) << 11) | (data[4] << 3) | ((data[5] & 0xE0) >>> 5); // 13 bits length ref: https://wiki.multimedia.cx/index.php?title=ADTS
    }

    static isOpusPattern (data:Uint8Array) {
        return true;//data[0] === 0xff && (data[1] & 0xf0) === 0xf0 && (data[1] & 0x06) === 0x00;
    }

    static extractOpus(buffer:Uint8Array) {
        let i = 0,
          length = buffer.byteLength,
          headerLength,
          frameLength;

        const result:Uint8Array[] = [];

        if (!OpusParser.isOpusPattern(buffer)) {
            debug.error('Invalid ADTS audio format');
            return result;
        }
        headerLength = OpusParser.getHeaderLength(buffer);
        if (!opusHeader) {
            opusHeader = buffer.subarray(0, headerLength);
        }

        while (i < length) {
            frameLength = OpusParser.getFrameLength(buffer);
            result.push(buffer.subarray(headerLength, frameLength));
            buffer = buffer.slice(frameLength);
            i += frameLength;
        }
        return result;
    }

    constructor(remuxer:BaseRemuxer) {
        super(remuxer);
    }

    setConfig() {
        // const headerData = OpusParser.getOpusHeaderData;
        // if (!headerData) return;

        // const config = new Uint8Array(2);
        const objectType = 0xAD;//((headerData[2] & 0xC0) >>> 6) + 1;
        // const sampleIndex = 0;//((headerData[2] & 0x3C) >>> 2);
        // let channelCount = ((headerData[2] & 0x01) << 2);
        // channelCount |= ((headerData[3] & 0xC0) >>> 6);

        const channelCount = 1;

        /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config */
        // config[0] = objectType << 3;
        // config[0] |= (sampleIndex & 0x0E) >> 1;
        // config[1] |= (sampleIndex & 0x01) << 7;
        // config[1] |= channelCount << 3;

        this.track.codec = 'mp4a.40.' + objectType;
        this.track.channelCount = channelCount;
        this.track.audiosamplerate = 24000;
        // this.track.config = config;
        this.remuxer.readyToDecode = true;
    }
}
