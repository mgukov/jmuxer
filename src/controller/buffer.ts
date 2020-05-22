import * as debug from '../util/debug';
import {Event} from '../util/event';
import { appendByteArray } from '../util/utils.js';

export default class BufferController extends Event {

    private readonly bufferType:string;
    private queue:Uint8Array|null = new Uint8Array();

    private cleaning = false;
    private pendingCleaning = 0;
    private cleanOffset = 30;
    private cleanRanges:number[][] = [];
    private sourceBuffer: SourceBuffer|null;

    constructor(sourceBuffer:SourceBuffer, type:string) {
        super('buffer');
        this.bufferType = type;
        this.sourceBuffer = sourceBuffer;
        this.sourceBuffer.addEventListener('updateend', ()=> {
            if (this.pendingCleaning > 0) {
                this.initCleanup(this.pendingCleaning);
                this.pendingCleaning = 0;
            }
            this.cleaning = false;
            if (this.cleanRanges.length) {
                this.doCleanup();
                return;
            }
        });

        this.sourceBuffer.addEventListener('error', ()=> {
            this.dispatch('error', { type: this.bufferType, name: 'buffer', error: 'buffer error' });
        });
    }

    destroy() {
        this.queue = null;
        this.sourceBuffer = null;
        this.offAll();
    }

    doCleanup() {
        if (!this.cleanRanges.length) {
            this.cleaning = false;
            return;
        }
        let range = this.cleanRanges.shift();
        this.cleaning = true;
        if (range && this.sourceBuffer) {
            debug.log(`${this.bufferType} remove range [${range[0]} - ${range[1]})`);
            this.sourceBuffer.remove(range[0], range[1]);
        }
    }

    initCleanup(cleanMaxLimit:number) {
        if (!this.sourceBuffer) {
            return;
        }

        if (this.sourceBuffer.updating) {
            this.pendingCleaning = cleanMaxLimit;
            return;
        }
        if (this.sourceBuffer.buffered && this.sourceBuffer.buffered.length && !this.cleaning) {
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
        if (!this.queue || !this.queue.length) return;

        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }

        try {
            this.sourceBuffer.appendBuffer(this.queue);
            this.queue = new Uint8Array();
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                debug.log(`${this.bufferType} buffer quota full`);
                this.dispatch('error', { type: this.bufferType, name: 'QuotaExceeded', error: 'buffer error' });
                return;
            }
            debug.error(`Error occured while appending ${this.bufferType} buffer -  ${e.name}: ${e.message}`);
            this.dispatch('error', { type: this.bufferType, name: 'unexpectedError', error: 'buffer error' });
        }
    }

    feed(data:Uint8Array) {
        if (this.queue) {
            this.queue = appendByteArray(this.queue, data);
        } else {
            this.queue = new Uint8Array(data);
        }
    }
}
