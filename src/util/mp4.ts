

export class Mp4 {
  static merge(...arrs: Uint8Array[]) {

    let size =  arrs.reduce((previousValue, val) => previousValue + val.length, 0);
    const arr = new Int8Array(size);

    let pos = 0;
    arrs.forEach(value => {
      arr.set(value, pos);
      pos += value.length;
    });
    return arr;
  }
}

export class Box {

  readonly type: string;
  readonly payloads: Uint8Array[] = [];


  constructor(type: string) {
    this.type = type;
  }

  appendPayload(...payload:Uint8Array[]) {
    this.payloads.push(...payload);
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

  private typeAsArray() {
    return [this.type[0], this.type[1], this.type[2], this.type[3]];
  }

  data() {
    Mp4.merge()
  }
}
