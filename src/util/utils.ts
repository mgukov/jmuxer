

export class Utils {

    static appendByteArray(buffer1: Uint8Array, buffer2: Uint8Array) {
        let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(buffer1, 0);
        tmp.set(buffer2, buffer1.byteLength);
        return tmp;
    }

    static secToTime(sec: number) {
        let seconds: number,
            hours: number,
            minutes: number;
        let result = '';

        seconds = Math.floor(sec);
        hours = seconds / 3600 % 24;
        minutes = seconds / 60 % 60;
        seconds = (seconds < 0) ? 0 : seconds % 60;

        if (hours > 0) {
            result += (hours < 10 ? '0' + hours : hours) + ':';
        }
        result += (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds);
        return result;
    }
}
