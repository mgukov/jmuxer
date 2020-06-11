

export class Mp4 {
  static merge(...arrs: Uint8Array[]) {

    let size =  arrs.reduce((previousValue, val) => previousValue + val.length, 0);
    const arr = new Uint8Array(size);

    let pos = 0;
    arrs.forEach(value => {
      arr.set(value, pos);
      pos += value.length;
    });
    return arr;
  }
}

export type BoxItem = Box|Uint8Array;

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


  readonly type: string;
  readonly items: BoxItem[] = [];

  constructor(type: string) {
    this.type = type;
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

  getContentSize() {
    const size:number = this.items.reduce((prev, val) =>  prev + ((val instanceof Box) ? val.getContentSize() + 8 : val.byteLength), 0);
    return size;
  }

  dump() : BoxDump {
    const childDumps: BoxDump[] = [];


    return {
      type: this.type,
      size: this.getContentSize(),
      children: childDumps
    };
  }
}
