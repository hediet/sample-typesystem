
export class BaseType {
    constructor(private arity: number, private name: string) {}

    public getArity() { return this.arity; }

    public toString() { return this.name; }
}

export class DistinctType extends BaseType {
    constructor(name: string, arity: number, private _assignableTo: Type[]) { 
        super(arity, name);
        _assignableTo.forEach(t => {
            if (t.arity() > arity)
                throw "invalid arity in type argument";
            if (t.normalize().length > 1)
                throw "cannot be assignable to a union type!";
        });
    }

    public close(...args: Type[]) { return new DistinctTypeInstantiation(this, args); }
    public directlyAssignableTo(): Type[] { return this._assignableTo; }
}

export class AliasType extends BaseType {
    constructor(name: string, arity: number, private _aliasedType: Type) { 
        super(arity, name);
        if (_aliasedType.arity() > arity)
            throw "invalid arity in type argument";
    }

    public close(...args: Type[]) { return new AliasTypeInstantiation(this, args); }
    public aliasedType(): Type { return this._aliasedType; }
}

export abstract class Type {
    public abstract arity(): number;
    public abstract insert(args: Type[]): Type;
    public abstract toString(): string;

    public abstract normalize(): DistinctTypeInstantiation[];
}

export abstract class TypeInstantiation extends Type {
    constructor(private type: BaseType, private typeArgs: Type[]) {
        super();

        if (type.getArity() != typeArgs.length)
            throw "invalid arity";
    }

    public arity(): number { return Math.max(0, ...this.typeArgs.map(t => t.arity())); }

    public toString(): string { 
        let res = this.type.toString();
        if (this.typeArgs.length > 0)
            res += "<" + this.typeArgs.map(t => t.toString()).join(", ") + ">";
        return res;
    }

    public getTypeArgs() { return this.typeArgs; }
    public getBaseType() { return this.type; }
}

export class DistinctTypeInstantiation extends TypeInstantiation {
    constructor(type: DistinctType, typeArgs: Type[]) { super(type, typeArgs); }

    public insert(args: Type[]): Type { return new DistinctTypeInstantiation(this.getType(), this.getTypeArgs().map(t => t.insert(args))); }

    public getType() { return this.getBaseType() as DistinctType; }

    public directlyAssignableTo(): Type[] {
        const b = this.getType();
        const args = this.getTypeArgs();
        return b.directlyAssignableTo().map(t => t.insert(args));
    }

    public assignableTo(): DistinctTypeInstantiation[] {
        const result: DistinctTypeInstantiation[] = [];
        result.push(this);
        this.directlyAssignableTo().forEach(t => {
            const n = t.normalize();
            if (n.length > 1) throw "bug";
            if (n.length == 1)
                result.push(...n[0].assignableTo());
        });

        return result;
    }

    public normalize() { return [ this ]; }
}

export class AliasTypeInstantiation extends TypeInstantiation {
    constructor(type: AliasType, typeArgs: Type[]) { super(type, typeArgs); }

    public insert(args: Type[]): Type { return new AliasTypeInstantiation(this.getType(), this.getTypeArgs().map(t => t.insert(args))); }

    public getType() { return this.getBaseType() as AliasType; }

    public aliasedType(): Type {
        const b = this.getType();
        const args = this.getTypeArgs();
        return b.aliasedType().insert(args);
    }

    public normalize() { return this.aliasedType().normalize(); }
}

export class UnionType extends Type {
    constructor(private type1: Type, private type2: Type) {
        super();
    }

    public arity(): number { return Math.max(this.type1.arity(), this.type2.arity()); }

    public insert(args: Type[]): Type { return new UnionType(this.type1.insert(args), this.type2.insert(args)); }

    public toString(): string { return this.type1.toString() + " | " + this.type2.toString(); }

    public normalize() { return this.type1.normalize().concat(this.type2.normalize()); }
}

export class TypeArgument extends Type {
    constructor(private id: number) {
        super();

        if (id <= 0) throw "id must be positive"; 
    }

    public getNumber(): number { return this.id; }

    public arity(): number { return this.id; }

    public insert(args: Type[]): Type { return (this.id <= args.length) ? args[this.id - 1] : this; }

    public toString(): string { return this.id.toString(); }

    public normalize(): DistinctTypeInstantiation[] { throw "only implemented for closed types!"; }
}



