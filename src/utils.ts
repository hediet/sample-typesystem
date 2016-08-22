export function selectMany<T1, T2>(arr: T1[], selector: (t: T1) => T2[]): T2[] {
    return arr.reduce((p, c) => { p.push(...selector(c)); return p; }, [] as T2[])
}

export function single<T>(arr: T[], noElementException: new() => any, 
        moreThenOneElementException: new() => any = null): T {
    if (arr.length == 0) throw new noElementException();
    if (arr.length != 1) throw new (moreThenOneElementException || noElementException);
    return arr[0];
}

export function range<T>(count: number) {
    const arr = [] as number[];
    for (let i = 0; i < count; i++) 
        arr[i] = i;
    return arr;
}

class ExtendableError extends Error {
    public stack: string;

    constructor(public message: string) {
        super(message);
        this.stack = (new Error() as any).stack;
    }
}

export class CannotInferError extends ExtendableError {
    constructor(message?: string) { super(message || "Cannot infer type."); }
}
export class AmbiguityError extends CannotInferError {
    constructor() { super("Multiple types can be inferred."); }
}
export class IncompatibilityError extends CannotInferError {
    constructor() { super("Incompatible types."); }
}

export class ImplementationError extends ExtendableError {
    constructor(msg?: string) { super(msg || "This error should not happen."); }
}
export class ArgumentError extends ExtendableError {
    constructor(msg?: string) { super(msg); }
}