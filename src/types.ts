import { AmbiguityError, IncompatibilityError, CannotInferError, 
    ArgumentError, ImplementationError, single, selectMany } from "./utils";

export enum Variance {
    In, Out, InOut
}

export abstract class TypeDefinition {
    constructor(private name: string, private typeParamVariances: Variance[]) {}

    public getTypeParamVariances() { return this.typeParamVariances; }
    public getArity() { return this.typeParamVariances.length; }
    public toString() { return this.name; }
    public abstract close(...args: Type[]): Type;
}

export class BaseTypeDefinition extends TypeDefinition {
    constructor(name: string, typeParamVariances: Variance[], private directlyAssignableTo: Type[]) { 
        super(name, typeParamVariances);
        if (directlyAssignableTo.some(t => t.getMaxArgPos() >= this.getArity()))
            throw new ArgumentError("invalid arity in type argument");
        if (directlyAssignableTo.some(t => t.normalize().length > 1))
            throw new ArgumentError("cannot be assignable to a union type!");
    }

    public close(...args: Type[]) { return new BaseType(this, args); }

    public getDirectlyAssignableTo(): Type[] { return this.directlyAssignableTo; }

    public closeWithInferredArgs(expectedType: Type): Type {
        const argVars = [] as TypeArgument[];
        for (let i = 0; i < this.getArity(); i++) argVars[i] = new TypeArgument(i);
        const assignableTo = this.close(...argVars).getAssignableTo();

        var matchings = selectMany(expectedType.normalizeClosed(), curExp => 
            assignableTo
                .filter(t => t.getBaseType() == curExp.getBaseType())
                .map(t => ({ given: t, expected: curExp }))
        );
        let { given, expected } = single(matchings, IncompatibilityError, AmbiguityError);

        const args = argVars.map(a => undefined as Type);
        BaseTypeDefinition.unify(given, expected, args);
        let idx = 0;
        const result = this.close(...args.map(t => t || new TypeArgument(idx++)));
        if (!result.isAssignableTo(expectedType)) throw new ImplementationError();
        return result;
    }

    private static unify(openType: Type, closedType: Type, typeArgs: Type[]) {
        const normalizedOpenType = single(openType.normalize(), CannotInferError);
        if (normalizedOpenType instanceof TypeArgument) {
            const oldValue = typeArgs[normalizedOpenType.getPosition()];
            if (oldValue == undefined) 
                typeArgs[normalizedOpenType.getPosition()] = closedType;
            else if (!oldValue.isEquivalentTo(closedType))
                throw new IncompatibilityError();
        }
        else if (normalizedOpenType instanceof BaseType) {
            const normalizedClosedType = single(closedType.normalizeClosed(), CannotInferError);
            if (normalizedOpenType.getBaseType() != normalizedClosedType.getBaseType())
                throw new IncompatibilityError();
            normalizedOpenType.getTypeArgs().forEach((t, i) => 
                this.unify(t, normalizedClosedType.getTypeArgs()[i], typeArgs)
            );
        }	
    }
}

export class AliasTypeDefinition extends TypeDefinition {
    constructor(name: string, arity: number, private aliasedType: Type) { 
        super(name, arity);
        if (aliasedType.getMaxArgPos() >= arity)
            throw new ArgumentError("invalid arity in type argument");
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
        var result = this.normalize(); 
        if (result.some(n => n instanceof TypeArgument))
            throw new ImplementationError("Unexpected TypeArgument was found: Underlying type was not closed.");
        return result as BaseType[]; 
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
        if (type.getArity() != typeArgs.length) throw new ArgumentError("invalid arity");
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
        return selectMany(this.getDirectlyAssignableTo(), t => {
            var bt = single(t.normalizeClosed(), ImplementationError);
            return [ bt ].concat(bt.getAssignableTo());
        });
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
        if (pos < 0) throw new ArgumentError("id must be non negative"); 
    }

    public getPosition(): number { return this.pos; }
    public getMaxArgPos(): number { return this.pos; }
    public insert(args: Type[]): Type { return (this.pos < args.length) ? args[this.pos] : this; }
    public normalize() { return [ this ]; }
    public toString(): string { return this.pos.toString(); }
}