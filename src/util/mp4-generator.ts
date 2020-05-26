import {Track} from "../remuxer/base";
import {TrackType} from "../controller/remux";

/**
 * Generate MP4 Box
 * taken from: https://github.com/dailymotion/hls.js
 */



export class MP4 {

    static initialized = false;
    static types = {
        avc1: [], // codingname
        avcC: [],
        btrt: [],
        dinf: [],
        dref: [],
        esds: [],
        ftyp: [],
        hdlr: [],
        mdat: [],
        mdhd: [],
        mdia: [],
        mfhd: [],
        minf: [],
        moof: [],
        moov: [],
        mp4a: [],
        mvex: [],
        mvhd: [],
        sdtp: [],
        stbl: [],
        stco: [],
        stsc: [],
        stsd: [],
        stsz: [],
        stts: [],
        tfdt: [],
        tfhd: [],
        traf: [],
        trak: [],
        trun: [],
        trex: [],
        tkhd: [],
        vmhd: [],
        smhd: [],
    } as {[Key: string]: number[]};

    static HDLR_TYPES: { video: Uint8Array, audio: Uint8Array };

    static STTS:Uint8Array;
    static STSC:Uint8Array;
    static STCO:Uint8Array;

    static STSZ = new Uint8Array([
        0x00, // version
        0x00, 0x00, 0x00, // flags
        0x00, 0x00, 0x00, 0x00, // sample_size
        0x00, 0x00, 0x00, 0x00, // sample_count
    ]);
    static VMHD = new Uint8Array([
        0x00, // version
        0x00, 0x00, 0x01, // flags
        0x00, 0x00, // graphicsmode
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00, // opcolor
    ]);
    static SMHD = new Uint8Array([
        0x00, // version
        0x00, 0x00, 0x00, // flags
        0x00, 0x00, // balance
        0x00, 0x00, // reserved
    ]);

    static STSD = new Uint8Array([
        0x00, // version 0
        0x00, 0x00, 0x00, // flags
        0x00, 0x00, 0x00, 0x01]);// entry_count


    static FTYP:Uint8Array;
    static DINF:Uint8Array;

    private static init() {

        for (const i in MP4.types) {
            if (MP4.types.hasOwnProperty(i)) {
                MP4.types[i] = [
                    i.charCodeAt(0),
                    i.charCodeAt(1),
                    i.charCodeAt(2),
                    i.charCodeAt(3),
                ];
            }
        }

        const videoHdlr = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x56, 0x69, 0x64, 0x65,
            0x6f, 0x48, 0x61, 0x6e,
            0x64, 0x6c, 0x65, 0x72, 0x00, // name: 'VideoHandler'
        ]);

        const audioHdlr = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00, // reserved
            0x53, 0x6f, 0x75, 0x6e,
            0x64, 0x48, 0x61, 0x6e,
            0x64, 0x6c, 0x65, 0x72, 0x00, // name: 'SoundHandler'
        ]);

        MP4.HDLR_TYPES = {
            video: videoHdlr,
            audio: audioHdlr,
        };

        const dref = new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x01, // entry_count
            0x00, 0x00, 0x00, 0x0c, // entry_size
            0x75, 0x72, 0x6c, 0x20, // 'url' type
            0x00, // version 0
            0x00, 0x00, 0x01, // entry_flags
        ]);

        const stco = new Uint8Array([
            0x00, // version
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x00, // entry_count
        ]);

        MP4.STTS = MP4.STSC = MP4.STCO = stco;

        const majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
        const avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
        const minorVersion = new Uint8Array([0, 0, 0, 1]);

        MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
        MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    }

    private static box(type:number[], ...payload:Uint8Array[]) {
        // calculate the total size we need to allocate
        let size = payload.reduce((prev, val) =>  prev + val.byteLength, 8);

        const result = new Uint8Array(size);
        result[0] = (size >> 24) & 0xff;
        result[1] = (size >> 16) & 0xff;
        result[2] = (size >> 8) & 0xff;
        result[3] = size & 0xff;
        result.set(type, 4);
        // copy the payload into the result

        for (let i = 0, pos = 8; i < payload.length; ++i) {
            // copy payload[i] array @ offset size
            result.set(payload[i], pos);
            pos += payload[i].byteLength;
        }
        return result;
    }

    private static hdlr(type:TrackType) {
        return MP4.box(MP4.types.hdlr, type === TrackType.Video ? MP4.HDLR_TYPES.video : MP4.HDLR_TYPES.audio);
    }

    private static mdhd(timescale:number, duration:number) {
        return MP4.box(MP4.types.mdhd, new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            0x00, 0x00, 0x00, 0x02, // creation_time
            0x00, 0x00, 0x00, 0x03, // modification_time
            (timescale >> 24) & 0xFF,
            (timescale >> 16) & 0xFF,
            (timescale >> 8) & 0xFF,
            timescale & 0xFF, // timescale
            (duration >> 24),
            (duration >> 16) & 0xFF,
            (duration >> 8) & 0xFF,
            duration & 0xFF, // duration
            0x55, 0xc4, // 'und' language (undetermined)
            0x00, 0x00,
        ]));
    }

    private static mdia(track:Track) {
        return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }

    private static mfhd(sequenceNumber:number) {
        return MP4.box(MP4.types.mfhd, new Uint8Array([
            0x00,
            0x00, 0x00, 0x00, // flags
            (sequenceNumber >> 24),
            (sequenceNumber >> 16) & 0xFF,
            (sequenceNumber >> 8) & 0xFF,
            sequenceNumber & 0xFF, // sequence_number
        ]));
    }

    private static minf(track:Track) {
        if (track.type === TrackType.Audio) {
            return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
        } else {
            return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
        }
    }

    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */
    private static moov(tracks:Track[], duration:number, timescale:number) {
        let i = tracks.length;
        const boxes:Uint8Array[] = [];

        while (i--) {
            boxes[i] = MP4.trak(tracks[i]);
        }
        return MP4.box( MP4.types.moov, ...[MP4.mvhd(timescale, duration)].concat(boxes).concat(MP4.mvex(tracks)));
    }

    private static mvex(tracks:Track[]) {
        let i = tracks.length,
            boxes = [];

        while (i--) {
            boxes[i] = MP4.trex(tracks[i]);
        }
        return MP4.box(MP4.types.mvex, ...boxes);
    }

    private static mvhd(timescale:number, duration:number) {
        var
            bytes = new Uint8Array([
                0x00, // version 0
                0x00, 0x00, 0x00, // flags
                0x00, 0x00, 0x00, 0x01, // creation_time
                0x00, 0x00, 0x00, 0x02, // modification_time
                (timescale >> 24) & 0xFF,
                (timescale >> 16) & 0xFF,
                (timescale >> 8) & 0xFF,
                timescale & 0xFF, // timescale
                (duration >> 24) & 0xFF,
                (duration >> 16) & 0xFF,
                (duration >> 8) & 0xFF,
                duration & 0xFF, // duration
                0x00, 0x01, 0x00, 0x00, // 1.0 rate
                0x01, 0x00, // 1.0 volume
                0x00, 0x00, // reserved
                0x00, 0x00, 0x00, 0x00, // reserved
                0x00, 0x00, 0x00, 0x00, // reserved
                0x00, 0x01, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x01, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, // pre_defined
                0xff, 0xff, 0xff, 0xff, // next_track_ID
            ]);
        return MP4.box(MP4.types.mvhd, bytes);
    }

    private static sdtp(track:Track) {
        var
            samples = track.samples || [],
            bytes = new Uint8Array(4 + samples.length),
            flags,
            i;
        // leave the full box header (4 bytes) all zero
        // write the sample table
        for (i = 0; i < samples.length; i++) {
            flags = samples[i].flags;
            bytes[i + 4] = (flags.dependsOn << 4) |
                (flags.isDependedOn << 2) |
                (flags.hasRedundancy);
        }

        return MP4.box(MP4.types.sdtp, bytes);
    }

    private static stbl(track:Track) {
        return MP4.box(
          MP4.types.stbl,
          MP4.stsd(track),
          MP4.box(MP4.types.stts, MP4.STTS),
          MP4.box(MP4.types.stsc, MP4.STSC),
          MP4.box(MP4.types.stsz, MP4.STSZ),
          MP4.box(MP4.types.stco, MP4.STCO)
        );
    }

    private static avc1(track:Track) {
        let sps:number[] = [];
        let pps:number[] = [];

        let i,
            data,
            len;
        // assemble the SPSs

        for (i = 0; i < track.sps.length; i++) {
            data = track.sps[i];
            len = data.byteLength;
            sps.push((len >>> 8) & 0xFF);
            sps.push((len & 0xFF));
            sps = sps.concat(Array.prototype.slice.call(data)); // SPS
        }

        // assemble the PPSs
        for (i = 0; i < track.pps.length; i++) {
            data = track.pps[i];
            len = data.byteLength;
            pps.push((len >>> 8) & 0xFF);
            pps.push((len & 0xFF));
            pps = pps.concat(Array.prototype.slice.call(data));
        }

        var avcc = MP4.box(MP4.types.avcC, new Uint8Array([
                0x01,   // version
                sps[3], // profile
                sps[4], // profile compat
                sps[5], // level
                0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
                0xE0 | track.sps.length, // 3bit reserved (111) + numOfSequenceParameterSets
            ].concat(sps).concat([
                track.pps.length, // numOfPictureParameterSets
            ]).concat(pps))), // "PPS"
            width = track.width!,
            height = track.height!;
        // console.log('avcc:' + Hex.hexDump(avcc));
        return MP4.box(MP4.types.avc1, new Uint8Array([
            0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, // reserved
            0x00, 0x01, // data_reference_index
            0x00, 0x00, // pre_defined
            0x00, 0x00, // reserved
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // pre_defined
            (width >> 8) & 0xFF,
            width & 0xff, // width
            (height >> 8) & 0xFF,
            height & 0xff, // height
            0x00, 0x48, 0x00, 0x00, // horizresolution
            0x00, 0x48, 0x00, 0x00, // vertresolution
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x01, // frame_count
            0x12,
            0x62, 0x69, 0x6E, 0x65, // binelpro.ru
            0x6C, 0x70, 0x72, 0x6F,
            0x2E, 0x72, 0x75, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, // compressorname
            0x00, 0x18,   // depth = 24
            0x11, 0x11]), // pre_defined = -1
        avcc,
        MP4.box(MP4.types.btrt, new Uint8Array([
            0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
            0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
            0x00, 0x2d, 0xc6, 0xc0])) // avgBitrate
        );
    }

    private static esds(track:Track) {
        let configlen = 0;
        let data = new Uint8Array(26 + configlen + 3);
        data.set([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags

            0x03, // descriptor_type
            0x17 + configlen, // length
            0x00, 0x01, // es_id
            0x00, // stream_priority

            0x04, // descriptor_type
            0x0f + configlen, // length
            0x40, // codec : mpeg4_audio
            0x15, // stream_type
            0x00, 0x00, 0x00, // buffer_size
            0x00, 0x00, 0x00, 0x00, // maxBitrate
            0x00, 0x00, 0x00, 0x00, // avgBitrate

            0x05, // descriptor_type
            configlen,
        ]);
        if (track.config) {
            configlen = track.config.byteLength;
            data.set(track.config, 26);
        }
        data.set([0x06, 0x01, 0x02], 26 + configlen);
        return data;
    }

    private static mp4a(track:Track) {
        const audiosamplerate = track.audiosamplerate ?? 24000;
        const channelCount = track.channelCount ?? 1;

        return MP4.box(MP4.types.mp4a, new Uint8Array([
            0x00, 0x00, 0x00, // reserved
            0x00, 0x00, 0x00, // reserved
            0x00, 0x01, // data_reference_index
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, channelCount, // channelcount
            0x00, 0x10, // sampleSize:16bits
            0x00, 0x00, // pre_defined
            0x00, 0x00, // reserved2
            (audiosamplerate >> 8) & 0xFF,
            audiosamplerate & 0xff, //
            0x00, 0x00]),
        MP4.box(MP4.types.esds, MP4.esds(track)));
    }

    private static stsd(track:Track) {
        if (track.type === TrackType.Audio) {
            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
        } else {
            return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
        }
    }

    private static tkhd(track:Track) {
        var id = track.id,
            duration = track.duration,
            width = track.width!,
            height = track.height!,
            volume = track.volume ?? 0;
        return MP4.box(MP4.types.tkhd, new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x07, // flags
            0x00, 0x00, 0x00, 0x00, // creation_time
            0x00, 0x00, 0x00, 0x00, // modification_time
            (id >> 24) & 0xFF,
            (id >> 16) & 0xFF,
            (id >> 8) & 0xFF,
            id & 0xFF, // track_ID
            0x00, 0x00, 0x00, 0x00, // reserved
            (duration >> 24),
            (duration >> 16) & 0xFF,
            (duration >> 8) & 0xFF,
            duration & 0xFF, // duration
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, // reserved
            0x00, 0x00, // layer
            0x00, 0x00, // alternate_group
            (volume >> 0) & 0xff, (((volume % 1) * 10) >> 0) & 0xff, // track volume // FIXME
            0x00, 0x00, // reserved
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
            (width >> 8) & 0xFF,
            width & 0xFF,
            0x00, 0x00, // width
            (height >> 8) & 0xFF,
            height & 0xFF,
            0x00, 0x00, // height
        ]));
    }

    private static traf(track:Track, baseMediaDecodeTime:number) {
        const sampleDependencyTable = MP4.sdtp(track),
            id = track.id;
        return MP4.box(MP4.types.traf,
            MP4.box(MP4.types.tfhd, new Uint8Array([
                0x00, // version 0
                0x00, 0x00, 0x00, // flags
                (id >> 24),
                (id >> 16) & 0XFF,
                (id >> 8) & 0XFF,
                (id & 0xFF), // track_ID
            ])),
            MP4.box(MP4.types.tfdt, new Uint8Array([
                0x00, // version 0
                0x00, 0x00, 0x00, // flags
                (baseMediaDecodeTime >> 24),
                (baseMediaDecodeTime >> 16) & 0XFF,
                (baseMediaDecodeTime >> 8) & 0XFF,
                (baseMediaDecodeTime & 0xFF), // baseMediaDecodeTime
            ])),
            MP4.trun(track,
                sampleDependencyTable.length +
                16 + // tfhd
                16 + // tfdt
                8 +  // traf header
                16 + // mfhd
                8 +  // moof header
                8),  // mdat header
            sampleDependencyTable);
    }

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */
    private static trak(track:Track) {
        track.duration = track.duration || 0xffffffff;
        return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }

    private static trex(track:Track) {
        const id = track.id;
        return MP4.box(MP4.types.trex, new Uint8Array([
            0x00, // version 0
            0x00, 0x00, 0x00, // flags
            (id >> 24),
            (id >> 16) & 0XFF,
            (id >> 8) & 0XFF,
            (id & 0xFF), // track_ID
            0x00, 0x00, 0x00, 0x01, // default_sample_description_index
            0x00, 0x00, 0x00, 0x00, // default_sample_duration
            0x00, 0x00, 0x00, 0x00, // default_sample_size
            0x00, 0x01, 0x00, 0x01, // default_sample_flags
        ]));
    }

    private static trun(track:Track, offset:number) {
        let samples = track.samples || [],
            len = samples.length,
            arraylen = 12 + (16 * len),
            array = new Uint8Array(arraylen),
            i,
            sample,
            duration,
            size,
            flags,
            cts;
        offset += 8 + arraylen;
        array.set([
            0x00, // version 0
            0x00, 0x0f, 0x01, // flags
            (len >>> 24) & 0xFF,
            (len >>> 16) & 0xFF,
            (len >>> 8) & 0xFF,
            len & 0xFF, // sample_count
            (offset >>> 24) & 0xFF,
            (offset >>> 16) & 0xFF,
            (offset >>> 8) & 0xFF,
            offset & 0xFF, // data_offset
        ], 0);
        for (i = 0; i < len; i++) {
            sample = samples[i];
            duration = sample.duration;
            size = sample.size;
            flags = sample.flags;
            cts = sample.cts;
            array.set([
                (duration >>> 24) & 0xFF,
                (duration >>> 16) & 0xFF,
                (duration >>> 8) & 0xFF,
                duration & 0xFF, // sample_duration
                (size >>> 24) & 0xFF,
                (size >>> 16) & 0xFF,
                (size >>> 8) & 0xFF,
                size & 0xFF, // sample_size
                (flags.isLeading << 2) | flags.dependsOn,
                (flags.isDependedOn << 6) |
                (flags.hasRedundancy << 4) |
                (flags.paddingValue << 1) |
                flags.isNonSync,
                flags.degradPrio & 0xF0 << 8,
                flags.degradPrio & 0x0F, // sample_flags
                (cts >>> 24) & 0xFF,
                (cts >>> 16) & 0xFF,
                (cts >>> 8) & 0xFF,
                cts & 0xFF, // sample_composition_time_offset
            ], 12 + 16 * i);
        }
        return MP4.box(MP4.types.trun, array);
    }



    static mdat(data:Uint8Array) {
        return MP4.box(MP4.types.mdat, data);
    }

    static moof(sn:number, baseMediaDecodeTime:number, track:Track) {
        return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    }

    static initSegment(tracks:Track[], duration:number, timescale:number) {
        if (!MP4.initialized) {
            MP4.init();
            MP4.initialized = true;
        }
        const movie = MP4.moov(tracks, duration, timescale);
        const result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
        result.set(MP4.FTYP);
        result.set(movie, MP4.FTYP.byteLength);
        return result;
    }
}
