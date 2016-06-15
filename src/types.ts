export class TypeDefinition {
    constructor(private name: string, private arity: number) {}

    public getArity() { return this.arity; }
    public toString() { return this.name; }
}

export class BaseTypeDefinition extends TypeDefinition {
    constructor(name: string, arity: number, private directlyAssignableTo: Type[]) { 
        super(name, arity);
        if (directlyAssignableTo.some(t => t.getMaxArgPos() >= arity))
            throw "invalid arity in type argument";
        if (directlyAssignableTo.some(t => t.normalize().length > 1))
            throw "cannot be assignable to a union type!";
    }

    public close(...args: Type[]) { return new BaseType(this, args); }

    public getDirectlyAssignableTo(): Type[] { return this.directlyAssignableTo; }

    public closeWithInferredArgs(expectedType: Type): Type {
        const argVars = [] as TypeArgument[];
        for (let i = 0; i < this.getArity(); i++) argVars[i] = new TypeArgument(i);
        const assignableTo = this.close(...argVars).getAssignableTo();

        let given: BaseType = null, expected: BaseType = null;

        for (const curExp of expectedType.normalizeClosed()) {
            const r = assignableTo.filter(t => t.getBaseType() == curExp.getBaseType());
            if (r.length == 1 && given == null)
                [ expected, given ] = [ curExp, r[0] ];
            else if (r.length > 1) {
                given = null;
                break;
            }
        }
        if (given == null) throw "cannot infer";

        const args = argVars.map(a => undefined as Type);
        BaseTypeDefinition.unify(given, expected, args);
        let idx = 0;
        const result = this.close(...args.map(t => t || new TypeArgument(idx++)));
        if (!result.isAssignableTo(expectedType)) throw "bug";
        return result;
    }

    private static unify(openType: Type, closedType: Type, typeArgs: Type[]) {
        const openTypes = openType.normalize();
        if (openTypes.length != 1) throw "cannot infer";
        
        const openType2 = openTypes[0];
        if (openType2 instanceof TypeArgument) {
            const oldValue = typeArgs[openType2.getPosition()];
            if (oldValue == undefined) 
                typeArgs[openType2.getPosition()] = closedType;
            else if (!oldValue.isEquivalentTo(closedType))
                throw "cannot infer";
        }
        else if (openType2 instanceof BaseType) {
            const closedTypes = closedType.normalizeClosed();
            if (closedTypes.length != 1) throw "cannot infer";
            const closedType2 = closedTypes[0];

            if (openType2.getBaseType() != closedType2.getBaseType())
                throw "cannot infer";

            openType2.getTypeArgs().forEach((t, i) => 
                this.unify(t, closedType2.getTypeArgs()[i], typeArgs)
            );
        }	
    }
}

export class AliasTypeDefinition extends TypeDefinition {
    constructor(name: string, arity: number, private aliasedType: Type) { 
        super(name, arity);
        if (aliasedType.getMaxArgPos() >= arity)
            throw "invalid arity in type argument";
    }

    public close(...args: Type[]) { return new AliasInstantiation(this, args); }
    public getAliasedType(): Type { return this.aliasedType; }
}

export abstract class Type {
    public abstract toString(): string;
    public abstract getMaxArgPos(): number;
    public abstract insert(args: Type[]): Type;
    public abstract normalize(): (BaseType | TypeArgument)[];

    public normalizeClosed() { 
        if (this.normalize().some(n => n instanceof TypeArgument))
            throw "unexpected TypeArgument was found";
        return this.normalize() as BaseType[]; 
    }

    public isEquivalentTo(other: Type) {
        return this.isAssignableTo(other) && other.isAssignableTo(this);
    }

    public isAssignableTo(other: Type): boolean {
        const otherNormalized = other.normalizeClosed();
        return this.normalizeClosed().every(e => otherNormalized.some(o => 
            e.getAssignableTo().filter(t => t.isEquivalentTo(o)).length > 0));
    }
}

export abstract class DefinitionInstantiation<T extends TypeDefinition> extends Type {
    constructor(private type: T, private typeArgs: Type[], 
                private ctor: new (type: T, args: Type[]) => Type) {
        super();
        if (type.getArity() != typeArgs.length)
            throw "invalid arity";
    }

    public getTypeArgs() { return this.typeArgs; }
    public getBaseType(): T { return this.type; }
    public getMaxArgPos(): number { return Math.max(-1, ...this.typeArgs.map(t => t.getMaxArgPos())); }

    public toString(): string { 
        let args = this.typeArgs.map(t => t.toString()).join(", ");
        return this.type.toString() + (args == "" ? "" : ("<" + args + ">"));
    }

    public insert(args: Type[]): Type { 
        return new this.ctor(this.getBaseType(), this.getTypeArgs().map(t => t.insert(args))); 
    }
}

export class BaseType extends DefinitionInstantiation<BaseTypeDefinition> {
    constructor(type: BaseTypeDefinition, typeArgs: Type[]) { 
        super(type, typeArgs, BaseType); 
    }

    public getDirectlyAssignableTo(): Type[] {
        return this.getBaseType().getDirectlyAssignableTo().map(t => t.insert(this.getTypeArgs()));
    }

    public getAssignableTo(): BaseType[] {
        return this.getDirectlyAssignableTo().reduce((prev, cur) => {
            const n = cur.normalizeClosed();
            if (n.length != 1) throw "bug";
            return prev.concat(n[0].getAssignableTo());
        }, [ this as BaseType ]);
    }

    public isEquivalentTo(other: Type) {
        if (other instanceof BaseType) {
            let o: BaseType = other;
            return this.getBaseType() == o.getBaseType() &&
                this.getTypeArgs().every((arg, i) => arg.isEquivalentTo(o.getTypeArgs()[i]));
        }
        return super.isEquivalentTo(other);
    }

    public normalize() { return [ this ]; }
}

export class AliasInstantiation extends DefinitionInstantiation<AliasTypeDefinition> {
    constructor(type: AliasTypeDefinition, typeArgs: Type[]) { super(type, typeArgs, AliasInstantiation); }

    public getAliasedType(): Type {
        return this.getBaseType().getAliasedType().insert(this.getTypeArgs());
    }
    public normalize() { return this.getAliasedType().normalize(); }
}

export class UnionType extends Type {
    constructor(private type1: Type, private type2: Type) { super(); }

    public getMaxArgPos(): number { return Math.max(this.type1.getMaxArgPos(), this.type2.getMaxArgPos()); }
    public insert(args: Type[]): Type { return new UnionType(this.type1.insert(args), this.type2.insert(args)); }
    public normalize() { return this.type1.normalize().concat(this.type2.normalize()); }
    public toString(): string { return this.type1.toString() + " | " + this.type2.toString(); }
}

export class TypeArgument extends Type {
    constructor(private pos: number) {
        super();
        if (pos < 0) throw "id must non negative"; 
    }

    public getPosition(): number { return this.pos; }
    public getMaxArgPos(): number { return this.pos; }
    public insert(args: Type[]): Type { return (this.pos < args.length) ? args[this.pos] : this; }
    public normalize() { return [ this ]; }
    public toString(): string { return this.pos.toString(); }
}