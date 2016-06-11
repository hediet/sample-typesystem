export class BaseType {
    constructor(private name: string, private arity: number) {}

    public getArity() { return this.arity; }
    public toString() { return this.name; }
}

export class DistinctType extends BaseType {
    constructor(name: string, arity: number, private directlyAssignableTo: Type[]) { 
        super(name, arity);
        if (directlyAssignableTo.some(t => t.getMaxArgId() >= arity))
            throw "invalid arity in type argument";
        if (directlyAssignableTo.some(t => t.normalize().length > 1))
            throw "cannot be assignable to a union type!";

        if (directlyAssignableTo.length == 0 && AnyType != undefined)
            directlyAssignableTo.push(AnyType);
    }

    public close(...args: Type[]) { return new DistinctTypeInstantiation(this, args); }

    public getDirectlyAssignableTo(): Type[] { return this.directlyAssignableTo; }

    public closeWithInferredArgs(expectedType: Type): Type {
        const args = [] as TypeArgument[];
        for (let i = 0; i < this.getArity(); i++) args[i] = new TypeArgument(i);
        const assignableTo = this.close(...args).getAssignableTo();

        let given: DistinctTypeInstantiation = null;
        let expected: DistinctTypeInstantiation = null;

        for (const curExpctd of expectedType.normalizeClosed()) {
            const r = assignableTo.filter(t => t.getBaseType() == curExpctd.getBaseType());
            if (r.length == 1 && given == null)
                [ expected, given ] = [ curExpctd, r[0] ];
            else if (r.length > 1) {
                given = null;
                break;
            }
        }

        if (given == null) throw "cannot infer";

        const concreteArgs = args.map(a => undefined as Type);
        DistinctType.unify(given, expected, concreteArgs);
        const result = this.close(...concreteArgs.map(t => t || AnyType));
        if (!result.isAssignableTo(expectedType)) throw "bug";
        return result;
    }

    private static unify(openType: Type, closedType: Type, typeArgs: Type[]) {
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

            openType2.getTypeArgs().forEach((t, i) => 
                this.unify(t, closedType2.getTypeArgs()[i], typeArgs)
            );
        }	
    }
}

export class AliasType extends BaseType {
    constructor(name: string, arity: number, private aliasedType: Type) { 
        super(name, arity);
        if (aliasedType.getMaxArgId() >= arity)
            throw "invalid arity in type argument";
    }

    public close(...args: Type[]) { return new AliasTypeInstantiation(this, args); }
    public getAliasedType(): Type { return this.aliasedType; }
}

export abstract class Type {
    public abstract getMaxArgId(): number;
    public abstract insert(args: Type[]): Type;
    public abstract normalize(): (DistinctTypeInstantiation | TypeArgument)[];
    public normalizeClosed() { 
        if (this.normalize().some(n => n instanceof TypeArgument))
            throw "unexpected TypeArgument was found";
        return this.normalize() as DistinctTypeInstantiation[]; 
    }

    public abstract toString(): string;

    public isEquivalentTo(other: Type) {
        return this.isAssignableTo(other) && other.isAssignableTo(this);
    }

    public isAssignableTo(other: Type): boolean {
        const otherNormalized = other.normalizeClosed();
        return this.normalizeClosed().every(e => otherNormalized.some(o => 
            e.getAssignableTo().filter(t => t.isEquivalentTo(o)).length > 0));
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

    public getMaxArgId(): number { return Math.max(0, ...this.typeArgs.map(t => t.getMaxArgId())); }

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

    public getDirectlyAssignableTo(): Type[] {
        return this.getType().getDirectlyAssignableTo().map(t => t.insert(this.getTypeArgs()));
    }

    public getAssignableTo(): DistinctTypeInstantiation[] {
        return this.getDirectlyAssignableTo().reduce((prev, cur) => {
            const n = cur.normalizeClosed();
            if (n.length != 1) throw "bug";
            return prev.concat(n[0].getAssignableTo());
        }, [ this as DistinctTypeInstantiation ]);
    }

    public isEquivalentTo(other: Type) {
        if (other instanceof DistinctTypeInstantiation) {
            let o: DistinctTypeInstantiation = other;
            return this.getBaseType() == o.getBaseType() &&
                this.getTypeArgs().every((arg, i) => arg.isEquivalentTo(o.getTypeArgs()[i]));
        }
        return super.isEquivalentTo(other);
    }

    public insert(args: Type[]): Type { return new DistinctTypeInstantiation(this.getType(), this.getTypeArgs().map(t => t.insert(args))); }
    public normalize() { return [ this ]; }
}

export const AnyType = new DistinctType("Any", 0, []).close();

export class AliasTypeInstantiation extends TypeInstantiation {
    constructor(type: AliasType, typeArgs: Type[]) { super(type, typeArgs); }
    public getType() { return this.getBaseType() as AliasType; }

    public getAliasedType(): Type {
        return this.getType().getAliasedType().insert(this.getTypeArgs());
    }

    public insert(args: Type[]): Type { return new AliasTypeInstantiation(this.getType(), this.getTypeArgs().map(t => t.insert(args))); }
    public normalize() { return this.getAliasedType().normalize(); }
}

export class UnionType extends Type {
    constructor(private type1: Type, private type2: Type) { super(); }

    public getMaxArgId(): number { return Math.max(this.type1.getMaxArgId(), this.type2.getMaxArgId()); }
    public insert(args: Type[]): Type { return new UnionType(this.type1.insert(args), this.type2.insert(args)); }
    public normalize() { return this.type1.normalize().concat(this.type2.normalize()); }
    public toString(): string { return this.type1.toString() + " | " + this.type2.toString(); }
}

export class TypeArgument extends Type {
    constructor(private id: number) {
        super();
        if (id < 0) throw "id must non negative"; 
    }

    public getNumber(): number { return this.id; }

    public getMaxArgId(): number { return this.id; }
    public insert(args: Type[]): Type { return (this.id < args.length) ? args[this.id] : this; }
    public normalize() { return [ this ]; }
    public toString(): string { return this.id.toString(); }
}