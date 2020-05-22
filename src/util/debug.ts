let logger:any;
let errorLogger:any;

export function setLogger() {
    /*eslint-disable */
    logger = console.log;
    errorLogger = console.error;
    /*eslint-enable */
}

export function isEnable() {
    return logger != null;
}

export function log(message:string, ...optionalParams:any) {
    if (logger) {
        logger(message, ...optionalParams);
    }
}
export function error(message:string, ...optionalParams:any) {
    if (errorLogger) {
        errorLogger(message, ...optionalParams);
    }
}
