
export class Event {

    private readonly type: string;
    private readonly listener: Map<string, ((e:any) => void)[]>;

    constructor(type:string) {
        this.listener = new Map<string, ((e:any) => void)[]>();
        this.type = type ?? '';
    }

    on(event:string, fn:(e:any) => void) {
        if (!this.listener.get(event)) {
            this.listener.set(event, []);
        }
        this.listener.get(event)!.push(fn);
        return true;
    }

    off(event:string, fn:(e:any) => void) {
        const listeners = this.listener.get(event);
        if (listeners) {
            const index = listeners.indexOf(fn);
            if (index > -1) {
                listeners.splice(index, 1);
            }
            return true;
        }
        return false;
    }

    offAll() {
        this.listener.clear();
    }

    dispatch(event:string, data:any = undefined) {

        const listeners = this.listener.get(event);
        if (listeners) {
            listeners.map((each) => {
                each.apply(null, [data]);
            });
            return true;
        }
        return false;
    }
}
