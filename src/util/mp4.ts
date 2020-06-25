import {TrackType} from "..";
import {Track} from "../remuxer/base";


export enum Boxes {
  avc1 = "avc1",
  avcC = "avcC",
  btrt = "btrt",
  dinf = "dinf",
  dref = "dref",
  esds = "esds",
  ftyp = "ftyp",
  hdlr = "hdlr",
  mdat = "mdat",
  mdhd = "mdhd",
  mdia = "mdia",
  mfhd = "mfhd",
  minf = "minf",
  moof = "moof",
  moov = "moov",
  mp4a = "mp4a",
  mvex = "mvex",
  mvhd = "mvhd",
  sdtp = "sdtp",
  stbl = "stbl",
  stco = "stco",
  stsc = "stsc",
  stsd = "stsd",
  stsz = "stsz",
  stts = "stts",
  tfdt = "tfdt",
  tfhd = "tfhd",
  traf = "traf",
  trak = "trak",
  trun = "trun",
  trex = "trex",
  tkhd = "tkhd",
  vmhd = "vmhd",
  smhd = "smhd"
}

export type BoxDump = {
  type:string;
  size:number;
  children:BoxDump[];
};

export class Box {

  private static box(type:number[], ...payload:BoxItem[]) {

    const dataArr:Uint8Array[] = [];
    payload.forEach(value => {
      const data = value instanceof Box ? value.getData() : value;
      if (data) {
        dataArr.push(data);
      }
    });

    const size = dataArr.reduce((prev, val) =>  prev + val.byteLength, 8);

    const result = new Uint8Array(size);
    result[0] = (size >> 24) & 0xff;
    result[1] = (size >> 16) & 0xff;
    result[2] = (size >> 8) & 0xff;
    result[3] = size & 0xff;
    result.set(type, 4);

    for (let i = 0, pos = 8; i < dataArr.length; ++i) {
      result.set(dataArr[i], pos);
      pos += dataArr[i].byteLength;
    }
    return result;
  }

  static make(type: string, ...items:BoxItem[]) {
    return new Box(type, ...items);
  }


  readonly type: string;
  readonly items: BoxItem[] = [];

  constructor(type: string, ...items:BoxItem[]) {
    this.type = type;

    if (items.length > 0) {
      this.addItem(...items);
    }
  }

  addItem(...items:BoxItem[]) {
    this.items.push(...items);
  }

  private typeAsArray() {
    return [this.type.charCodeAt(0), this.type.charCodeAt(1), this.type.charCodeAt(2), this.type.charCodeAt(3)];
  }

  getData() : Uint8Array {
    return Box.box(this.typeAsArray(), ...this.items);
  }

  getSize() {
    const size:number = this.items.reduce((prev, val) =>  prev + ((val instanceof Box) ? val.getSize() : val.byteLength), 8);
    return size;
  }

  dump() : BoxDump {
    const childDumps: BoxDump[] = [];

    this.items.forEach(value => {
      if (value instanceof Box) {
        childDumps.push(value.dump());
      }
    });

    return {
      type: this.type,
      size: this.getSize(),
      children: childDumps
    };
  }
}

export class Mp4 {

  static STSZ = Box.make(Boxes.stsz, new Uint8Array([
    0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // sample_size
    0x00, 0x00, 0x00, 0x00, // sample_count
  ]));

  static VMHD = Box.make(Boxes.vmhd, new Uint8Array([
    0x00, // version
    0x00, 0x00, 0x01, // flags
    0x00, 0x00, // graphicsmode
    0x00, 0x00,
    0x00, 0x00,
    0x00, 0x00, // opcolor
  ]));

  public static SMHD = Box.make(Boxes.smhd, new Uint8Array([
    0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, // balance
    0x00, 0x00, // reserved
  ]));

  static HDLR_VIDEO = Box.make(Boxes.hdlr, new Uint8Array([
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
  ]));

  static HDLR_AUDIO = Box.make(Boxes.hdlr, new Uint8Array([
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
  ]));

  static STTS = Box.make(Boxes.stts, new Uint8Array([
    0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // entry_count
  ]));

  static STSC = Box.make(Boxes.stsc, new Uint8Array([
    0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // entry_count
  ]));

  static STCO = Box.make(Boxes.stco, new Uint8Array([
    0x00, // version
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x00, // entry_count
  ]));

  static FTYP = Box.make(Boxes.ftyp,
      new Uint8Array([105, 115, 111, 109]),
      new Uint8Array([0, 0, 0, 1]),
      new Uint8Array([105, 115, 111, 109]),
      new Uint8Array([97, 118, 99, 49])
  );

  static DINF = Box.make(Boxes.dinf, Box.make(Boxes.dref, new Uint8Array([
    0x00, // version 0
    0x00, 0x00, 0x00, // flags
    0x00, 0x00, 0x00, 0x01, // entry_count
    0x00, 0x00, 0x00, 0x0c, // entry_size
    0x75, 0x72, 0x6c, 0x20, // 'url' type
    0x00, // version 0
    0x00, 0x00, 0x01, // entry_flags
  ])));


  private static hdlr(type:TrackType) {
    return type === TrackType.Video ? Mp4.HDLR_VIDEO : Mp4.HDLR_AUDIO;
  }

  private static mdhd(timescale:number, duration:number) {
    return Box.make(Boxes.mdhd, new Uint8Array([
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
    return Box.make(Boxes.mdia, Mp4.mdhd(track.timescale, track.duration), Mp4.hdlr(track.type), Mp4.minf(track));
  }

  private static mfhd(sequenceNumber:number) {
    return Box.make(Boxes.mfhd, new Uint8Array([
      0x00,
      0x00, 0x00, 0x00, // flags
      (sequenceNumber >> 24),
      (sequenceNumber >> 16) & 0xFF,
      (sequenceNumber >> 8) & 0xFF,
      sequenceNumber & 0xFF, // sequence_number
    ]));
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

    return Box.make(Boxes.esds, data);
  }

  private static mp4a(track:Track) {
    const audiosamplerate = track.audiosamplerate ?? 24000;
    const channelCount = track.channelCount ?? 1;

    return Box.make(Boxes.mp4a, new Uint8Array([
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
        Mp4.esds(track));
  }

  private static avc1(track:Track) {
    let sps:number[] = [];
    let pps:number[] = [];

    const spsLen = track.sps?.length ?? 0;
    const ppsLen = track.pps?.length ?? 0;

    // assemble the SPSs
    if (track.sps) {
      for (let i = 0; i < track.sps.length; i++) {
        const data = track.sps[i];
        const len = data.byteLength;
        sps.push((len >>> 8) & 0xFF);
        sps.push((len & 0xFF));
        sps = sps.concat(Array.prototype.slice.call(data)); // SPS
      }
    }
    // assemble the PPSs
    if (track.pps) {
      for (let i = 0; i < track.pps.length; i++) {
        const data = track.pps[i];
        const len = data.byteLength;
        pps.push((len >>> 8) & 0xFF);
        pps.push((len & 0xFF));
        pps = pps.concat(Array.prototype.slice.call(data));
      }
    }
    const avcc = Box.make(Boxes.avcC, new Uint8Array([
          0x01,   // version
          sps[3], // profile
          sps[4], // profile compat
          sps[5], // level
          0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
          0xE0 | spsLen, // 3bit reserved (111) + numOfSequenceParameterSets
        ].concat(sps).concat([
          ppsLen, // numOfPictureParameterSets
        ]).concat(pps))), // "PPS"
        width = track.width!,
        height = track.height!;
    // console.log('avcc:' + Hex.hexDump(avcc));
    return Box.make(Boxes.avc1, new Uint8Array([
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
        Box.make(Boxes.btrt, new Uint8Array([
          0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
          0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
          0x00, 0x2d, 0xc6, 0xc0])) // avgBitrate
    );
  }

  private static stsd(track:Track) {
    if (track.type === TrackType.Audio) {
      return Box.make(Boxes.stsd, new Uint8Array([
        0x00, // version 0
        0x00, 0x00, 0x00, // flags
        0x00, 0x00, 0x00, 0x01
      ]), Mp4.mp4a(track));// entry_count

    } else {
      return Box.make(Boxes.stsd, new Uint8Array([
        0x00, // version 0
        0x00, 0x00, 0x00, // flags
        0x00, 0x00, 0x00, 0x01
      ]), Mp4.avc1(track));// entry_count
    }
  }

  private static stbl(track:Track) {
    return Box.make(
        Boxes.stbl,
        Mp4.stsd(track),
        Mp4.STTS,
        Mp4.STSC,
        Mp4.STSZ,
        Mp4.STCO
    );
  }

  private static minf(track:Track) {
    if (track.type === TrackType.Audio) {
      return Box.make(Boxes.minf, Mp4.SMHD, Mp4.DINF, Mp4.stbl(track));
    } else {
      return Box.make(Boxes.minf, Mp4.VMHD, Mp4.DINF, Mp4.stbl(track));
    }
  }

  private static tkhd(track:Track) {
    const id = track.id,
        duration = track.duration,
        width = track.width!,
        height = track.height!,
        volume = track.volume ?? 0;
    return Box.make(Boxes.tkhd, new Uint8Array([
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

  private static trak(track:Track) {
    track.duration = track.duration || 0xffffffff;
    return Box.make(Boxes.trak, Mp4.tkhd(track), Mp4.mdia(track));
  }

  private static mvhd(timescale:number, duration:number) {
    const bytes = new Uint8Array([
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
    return Box.make(Boxes.mvhd, bytes);
  }

  private static trex(track:Track) {
    const id = track.id;
    return Box.make(Boxes.trex, new Uint8Array([
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

  private static mvex(tracks:Track[]) {
    let i = tracks.length,
        boxes = [];

    while (i--) {
      boxes[i] = Mp4.trex(tracks[i]);
    }
    return Box.make(Boxes.mvex, ...boxes);
  }

  private static moov(tracks:Track[], duration:number, timescale:number) {
    const boxes:BoxItem[] = [Mp4.mvhd(timescale, duration)];

    tracks.forEach(track => {
      boxes.push(Mp4.trak(track));
    });
    boxes.push(Mp4.mvex(tracks));
    return Box.make(Boxes.moov, ...boxes);
  }

  private static trun(track:Track, offset:number) {

    const samples = track.samples;
    const len = samples.length;
    const arraylen = 12 + (16 * len);
    const array = new Uint8Array(arraylen);

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

    for (let i = 0; i < len; i++) {
      const sample = samples[i];
      const duration = sample.duration;
      const size = sample.size;
      const flags = sample.flags;
      const cts = sample.cts;
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
    return Box.make(Boxes.trun, array);
  }

  private static sdtp(track:Track) {
    const samples = track.samples;
    const bytes = new Uint8Array(4 + samples.length);
    // leave the full box header (4 bytes) all zero
    // write the sample table
    for (let i = 0; i < samples.length; i++) {
      const flags = samples[i].flags;
      bytes[i + 4] = (flags.dependsOn << 4) |
          (flags.isDependedOn << 2) |
          (flags.hasRedundancy);
    }

    return Box.make(Boxes.sdtp, bytes);
  }

  private static traf(track:Track, baseMediaDecodeTime:number) {
    const sampleDependencyTable = Mp4.sdtp(track),
        id = track.id;
    return Box.make(Boxes.traf,
        Box.make(Boxes.tfhd, new Uint8Array([
          0x00, // version 0
          0x00, 0x00, 0x00, // flags
          (id >> 24),
          (id >> 16) & 0XFF,
          (id >> 8) & 0XFF,
          (id & 0xFF), // track_ID
        ])),
        Box.make(Boxes.tfdt, new Uint8Array([
          0x00, // version 0
          0x00, 0x00, 0x00, // flags
          (baseMediaDecodeTime >> 24),
          (baseMediaDecodeTime >> 16) & 0XFF,
          (baseMediaDecodeTime >> 8) & 0XFF,
          (baseMediaDecodeTime & 0xFF), // baseMediaDecodeTime
        ])),
        Mp4.trun(track,
            sampleDependencyTable.getSize() +
            16 + // tfhd
            16 + // tfdt
            8 +  // traf header
            16 + // mfhd
            8 +  // moof header
            8),  // mdat header
        sampleDependencyTable);
  }



  static moof(sn:number, baseMediaDecodeTime:number, track:Track) {
    return Box.make(Boxes.moof, Mp4.mfhd(sn), Mp4.traf(track, baseMediaDecodeTime));
  }

  static mdat(data:Uint8Array) {
    return Box.make(Boxes.mdat, data);
  }

  static initSegment(tracks:Track[], duration:number, timescale:number) {
    const movie = Mp4.moov(tracks, duration, timescale);
    const result = new Uint8Array(Mp4.FTYP.getSize() + movie.getSize());
    result.set(Mp4.FTYP.getData());
    result.set(movie.getData(), Mp4.FTYP.getSize());
    return result;
  }
}

export type BoxItem = Box|Uint8Array;
