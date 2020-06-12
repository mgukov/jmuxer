import * as debug from '../util/debug';
import {Event} from '../util/event';
import {Utils} from '../util/utils';

export default class BufferController extends Event {

    private queue: Uint8Array = new Uint8Array(0);

    private cleaning = false;
    private pendingCleaning = 0;
    private cleanOffset = 30;
    private cleanRanges: number[][] = [];

    constructor(
        public readonly sourceBuffer: SourceBuffer,
        private readonly bufferType: string
    ) {

        super('buffer');

        this.sourceBuffer.addEventListener('update', () => this.onUpdate());
        this.sourceBuffer.addEventListener('updateend', () => this.onUpdateend());
        this.sourceBuffer.addEventListener('error', err => this.onError(err));
    }

    private onUpdateend() {
        if (this.pendingCleaning > 0) {
            this.initCleanup(this.pendingCleaning);
            this.pendingCleaning = 0;
        }
        this.cleaning = false;
        if (this.cleanRanges.length) {
            this.doCleanup();
            return;
        }
    }

    private onError(err:any) {
        this.dispatch('error', {type: this.bufferType, name: 'buffer', error: 'buffer error', src: err});
    }

    private onUpdate() {
        debug.log('sourceBuffer:update');
    }

    destroy() {
        this.queue = new Uint8Array(0);
        // this.sourceBuffer = null;
        this.offAll();
    }

    doCleanup() {
        if (!this.cleanRanges.length) {
            this.cleaning = false;
            return;
        }
        let range = this.cleanRanges.shift();
        this.cleaning = true;
        if (range) {
            debug.log(`${this.bufferType} remove range [${range[0]} - ${range[1]})`);
            this.sourceBuffer.remove(range[0], range[1]);
        }
    }

    initCleanup(cleanMaxLimit: number) {
        if (this.sourceBuffer.updating) {
            this.pendingCleaning = cleanMaxLimit;
            return;
        }

        if (this.sourceBuffer.buffered && this.sourceBuffer.buffered.length && !this.cleaning) {
            console.log('@initCleanup cleanMaxLimit:' + cleanMaxLimit)

            for (let i = 0; i < this.sourceBuffer.buffered.length; ++i) {
                let start = this.sourceBuffer.buffered.start(i);
                let end = this.sourceBuffer.buffered.end(i);

                if ((cleanMaxLimit - start) > this.cleanOffset) {
                    end = cleanMaxLimit - this.cleanOffset;
                    if (start < end) {
                        this.cleanRanges.push([start, end]);
                    }
                }
            }
            this.doCleanup();
        }
    }

    doAppend() {
        if (this.queue.length == 0 || this.sourceBuffer.updating) {
            return;
        }

        try {
            this.sourceBuffer.appendBuffer(this.queue);
            this.queue = new Uint8Array();
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                debug.log(`${this.bufferType} buffer quota full`);
                this.dispatch('error', {type: this.bufferType, name: 'QuotaExceeded', error: 'buffer error'});
                return;
            }
            debug.error(`Error occured while appending ${this.bufferType} buffer -  ${e.name}: ${e.message}`);
            this.dispatch('error', {type: this.bufferType, name: 'unexpectedError', error: 'buffer error'});
        }
    }

    feed(data: Uint8Array) {
        if (this.queue.length > 0) {
            this.queue = Utils.appendByteArray(this.queue, data);
        } else {
            this.queue = new Uint8Array(data);
        }
    }
}
