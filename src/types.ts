
export class BaseType {
    constructor(private name: string, private arity: number) {}

    public getArity() { return this.arity; }
    public toString() { return this.name; }
}


export class DistinctType extends BaseType {

    public static Any = new DistinctType("Any", 0, []);

    constructor(name: string, arity: number, private directlyAssignableTo: Type[]) { 
        super(name, arity);
        directlyAssignableTo.forEach(t => {
            if (t.arity() > arity)
                throw "invalid arity in type argument";
            if (t.normalize().length > 1)
                throw "cannot be assignable to a union type!";
        });
        if (directlyAssignableTo.length == 0 && DistinctType.Any != undefined)
            directlyAssignableTo.push(DistinctType.Any.close());
    }

    public close(...args: Type[]) { return new DistinctTypeInstantiation(this, args); }
    public getDirectlyAssignableTo(): Type[] { return this.directlyAssignableTo; }



    private unify(openType: Type, closedType: Type, typeArgs: { [id: number]: Type; }) {
        const openTypes = openType.normalize();
        if (openTypes.length != 1)
            throw "cannot infer";
        
        const openType2 = openTypes[0];

        if (openType2 instanceof TypeArgument) {
            const oldValue = typeArgs[openType2.getNumber()];
            if (oldValue == undefined) 
                typeArgs[openType2.getNumber()] = closedType;
            else if (!oldValue.isEquivalentTo(closedType))
                throw "cannot infer";
        }
        else if (openType2 instanceof DistinctTypeInstantiation) {
            const closedTypes = closedType.normalizeClosed();
            if (closedTypes.length != 1)
                throw "cannot infer";
            const closedType2 = closedTypes[0];

            if (openType2.getBaseType() != closedType2.getBaseType())
                throw "cannot infer";

            const closedType2Args = closedType2.getTypeArgs();
            openType2.getTypeArgs().forEach((t, i) => {
                this.unify(t, closedType2Args[i], typeArgs);
            });
        }	
    }

    public closeWithInferredArgs(expectedType: Type): Type {
        const args: Type[] = [];
        for (let i = 1; i <= this.getArity(); i++)
            args.push(new TypeArgument(i));

        const assignableTo = this.close(...args).assignableTo();

        const relevantTypes: DistinctTypeInstantiation[] = [];
        let expected: DistinctTypeInstantiation = null;

        for (const e of expectedType.normalizeClosed()) {
            const r = assignableTo.filter(t => t.getBaseType() == e.getBaseType());
            if (r.length > 0) expected = e;
            relevantTypes.push(...r);
        }

        if (relevantTypes.length != 1)
            throw "cannot infer";

        const t = relevantTypes[0];

        const typeArgs: { [id: number]: Type; } = {};
        this.unify(t, expected, typeArgs);

        const typeArgs2: Type[] = [];
        for (let i = 1; i <= this.getArity(); i++)
            typeArgs2.push((typeArgs[i] != undefined) ? typeArgs[i] : DistinctType.Any.close());

        const result = this.close(...typeArgs2);
        console.log(result.isAssignableTo(expectedType));
        return result;
    }
}

export class AliasType extends BaseType {
    constructor(name: string, arity: number, private _aliasedType: Type) { 
        super(name, arity);
        if (_aliasedType.arity() > arity)
            throw "invalid arity in type argument";
    }

    public close(...args: Type[]) { return new AliasTypeInstantiation(this, args); }
    public aliasedType(): Type { return this._aliasedType; }
}

export abstract class Type {
    public abstract arity(): number;
    public abstract insert(args: Type[]): Type;
    public abstract normalize(): (DistinctTypeInstantiation | TypeArgument)[];
    public normalizeClosed() { 
        this.normalize().forEach(n => {
            if (n instanceof TypeArgument) throw "cannot normalize2 TypeArgument";
        });
        return this.normalize() as DistinctTypeInstantiation[]; 
    }

    public abstract toString(): string;

    public isEquivalentTo(other: Type) {
        return this.isAssignableTo(other) && other.isAssignableTo(this);
    }

    public isAssignableTo(other: Type): boolean {
        const otherNormalized = other.normalizeClosed();
        return this.normalizeClosed()
            .every(e => otherNormalized
                .some(o => 
                    {
                        const args = o.getTypeArgs();
                        return e.assignableTo()
                            .filter(t => t.getBaseType() == o.getBaseType())
                            .some(t => t.getTypeArgs()
                                .every((arg, i) => arg.isEquivalentTo(args[i])));
                    }));
    }
}

export abstract class TypeInstantiation extends Type {
    constructor(private type: BaseType, private typeArgs: Type[]) {
        super();
        if (type.getArity() != typeArgs.length)
            throw "invalid arity";
    }

    public getTypeArgs() { return this.typeArgs; }
    public getBaseType() { return this.type; }

    public arity(): number { return Math.max(0, ...this.typeArgs.map(t => t.arity())); }

    public toString(): string { 
        let res = this.type.toString();
        if (this.typeArgs.length > 0)
            res += "<" + this.typeArgs.map(t => t.toString()).join(", ") + ">";
        return res;
    }
}

export class DistinctTypeInstantiation extends TypeInstantiation {
    constructor(type: DistinctType, typeArgs: Type[]) { super(type, typeArgs); }
   
    public getType() { return this.getBaseType() as DistinctType; }

    public directlyAssignableTo(): Type[] {
        const b = this.getType();
        const args = this.getTypeArgs();
        return b.getDirectlyAssignableTo().map(t => t.insert(args));
    }

    public assignableTo(): DistinctTypeInstantiation[] {
        const result: DistinctTypeInstantiation[] = [];
        result.push(this);
        this.directlyAssignableTo().forEach(t => {
            const n = t.normalizeClosed();
            if (n.length > 1) throw "bug";
            if (n.length == 1)
                result.push(...n[0].assignableTo());
        });

        return result;
    }

    public insert(args: Type[]): Type { return new DistinctTypeInstantiation(this.getType(), this.getTypeArgs().map(t => t.insert(args))); }
    public normalize() { return [ this ]; }
}

export class AliasTypeInstantiation extends TypeInstantiation {
    constructor(type: AliasType, typeArgs: Type[]) { super(type, typeArgs); }
    public getType() { return this.getBaseType() as AliasType; }

    public aliasedType(): Type {
        const b = this.getType();
        const args = this.getTypeArgs();
        return b.aliasedType().insert(args);
    }

    public insert(args: Type[]): Type { return new AliasTypeInstantiation(this.getType(), this.getTypeArgs().map(t => t.insert(args))); }
    public normalize() { return this.aliasedType().normalize(); }
}

export class UnionType extends Type {
    constructor(private type1: Type, private type2: Type) {
        super();
    }

    public arity(): number { return Math.max(this.type1.arity(), this.type2.arity()); }
    public insert(args: Type[]): Type { return new UnionType(this.type1.insert(args), this.type2.insert(args)); }
    public normalize() { return this.type1.normalize().concat(this.type2.normalize()); }
    public toString(): string { return this.type1.toString() + " | " + this.type2.toString(); }
}

export class TypeArgument extends Type {
    constructor(private id: number) {
        super();
        if (id <= 0) throw "id must be positive"; 
    }

    public getNumber(): number { return this.id; }

    public arity(): number { return this.id; }
    public insert(args: Type[]): Type { return (this.id <= args.length) ? args[this.id - 1] : this; }
    public normalize() { return [ this ]; }
    public toString(): string { return this.id.toString(); }
}


