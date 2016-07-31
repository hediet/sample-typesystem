import { AmbiguityError, IncompatibilityError, CannotInferError, 
    ArgumentError, ImplementationError, single, selectMany } from "./utils";



export abstract class Type { }

export abstract class DefinitionInstantiation extends Type {
    constructor(baseType: TypeDefinition, public typeArgs: Type[]) {
        super();
        if (baseType.getArity() != typeArgs.length) throw new ArgumentError("invalid arity");
    }
}

export class BaseType extends DefinitionInstantiation {
    constructor(public baseType: BaseTypeDefinition, typeArgs: Type[]) { super(baseType, typeArgs); }

    public getDirectlyAssignableTo(): Type[] {
        return this.baseType.directlyAssignableTo.map(t => insert(t, this.typeArgs));
    }

    public getAssignableTo(): BaseType[] {
        return selectMany(this.getDirectlyAssignableTo(), t => {
            var bt = single(normalizeClosed(t), ImplementationError);
            return [ bt ].concat(bt.getAssignableTo());
        });
    }
}

export class AliasInstantiation extends DefinitionInstantiation {
    constructor(public baseType: AliasTypeDefinition, typeArgs: Type[]) { super(baseType, typeArgs); }

    public getAliasedType(): Type {
        return insert(this.baseType.aliasedType, this.typeArgs);
    }
}

export class UnionType extends Type {
    constructor(public type1: Type, public type2: Type) { super(); }
    
    public get typeArgs(): Type[] { return [ this.type1, this.type2 ]; } 
}

export class TypeArgument extends Type {
    constructor(public pos: number) {
        super();
        if (pos < 0) throw new ArgumentError("id must be non negative"); 
    }
}


export enum Variance {
    In, Out, InOut
}

export abstract class TypeDefinition {
    constructor(private name: string, private arity: number) {}

    public getArity() { return this.arity; }
    public toString() { return this.name; }
    public abstract close(...args: Type[]): Type;
}

export class BaseTypeDefinition extends TypeDefinition {
    constructor(name: string, public typeParamVariances: Variance[], public directlyAssignableTo: DefinitionInstantiation[]) { 
        super(name, typeParamVariances.length);
        if (directlyAssignableTo.some(t => getMaxArgPos(t) >= this.getArity()))
            throw new ArgumentError("invalid arity in type argument");
        directlyAssignableTo.forEach(t => {
            var normalized = normalizeClosed(t);
            if (normalized.length != 1) throw new ArgumentError("cannot be assignable to a union type!");
            ensureParamVariances(normalized[0], typeParamVariances);
        }); 
    }

    public close(...args: Type[]) { return new BaseType(this, args); }

    public closeWithInferredArgs(expectedType: Type): Type {
        const argVars = [] as TypeArgument[];
        for (let i = 0; i < this.getArity(); i++) argVars[i] = new TypeArgument(i);
        const assignableTo = this.close(...argVars).getAssignableTo();

        var matchings = selectMany(normalizeClosed(expectedType), curExp => 
            assignableTo
                .filter(t => t.baseType == curExp.baseType)
                .map(t => ({ given: t, expected: curExp }))
        );
        let { given, expected } = single(matchings, IncompatibilityError, AmbiguityError);

        const args = argVars.map(a => undefined as Type);
        BaseTypeDefinition.unify(given, expected, args);
        let idx = 0;
        const result = this.close(...args.map(t => t || new TypeArgument(idx++)));
        if (!isAssignableTo(result, expectedType)) throw new ImplementationError();
        return result;
    }

    private static unify(openType: Type, closedType: Type, typeArgs: Type[]) {
        const normalizedOpenType = single(normalize(openType), CannotInferError);
        if (normalizedOpenType instanceof TypeArgument) {
            const oldValue = typeArgs[normalizedOpenType.pos];
            if (oldValue == undefined) 
                typeArgs[normalizedOpenType.pos] = closedType;
            else if (!isEquivalentTo(oldValue, closedType))
                throw new IncompatibilityError();
        }
        else if (normalizedOpenType instanceof BaseType) {
            const normalizedClosedType = single(normalizeClosed(closedType), CannotInferError);
            if (normalizedOpenType.baseType != normalizedClosedType.baseType)
                throw new IncompatibilityError();
            normalizedOpenType.typeArgs.forEach((t, i) => 
                this.unify(t, normalizedClosedType.typeArgs[i], typeArgs)
            );
        }	
    }
}

export class AliasTypeDefinition extends TypeDefinition {
    constructor(name: string, arity: number, public aliasedType: Type) { 
        super(name, arity);
        if (getMaxArgPos(aliasedType) >= this.getArity()) throw new ArgumentError("invalid arity in type argument");
    }

    public close(...args: Type[]) { return new AliasInstantiation(this, args); }
}

function ensureParamVariances(type: BaseType, typeParamVariances: Variance[]) {

    type.typeArgs.forEach((arg, idx) => {
        normalize(arg).forEach(t => { 
            if (t instanceof TypeArgument) {
                var given = typeParamVariances[t.pos];
                var expected = type.baseType.typeParamVariances[idx];
                if (given != expected && given != Variance.InOut)
                    throw new ArgumentError(`Invariance violated! Typeparameter ${ t.pos } with variance ${ given } must be compatible to variance ${ expected }.`);
            }
            else if (t instanceof BaseType) {
                ensureParamVariances(t, typeParamVariances);
            }
        });
    });
}

function insertMany(types: Type[], args: Type[]): Type[] { return types.map(t => insert(t, args)); }

function insert(type: Type, args: Type[]): Type {
    if (type instanceof BaseType)           return new BaseType(type.baseType, insertMany(type.typeArgs, args));
    if (type instanceof AliasInstantiation) return new AliasInstantiation(type.baseType, insertMany(type.typeArgs, args));
    if (type instanceof UnionType)          return new UnionType(insert(type.type1, args), insert(type.type2, args));
    if (type instanceof TypeArgument)       return (type.pos < args.length) ? args[type.pos] : type;
}

function toString(type: Type) {
    if (type instanceof BaseType || type instanceof AliasInstantiation) {
        let args = type.typeArgs.map(t => t.toString()).join(", ");
        return type.baseType.toString() + (args == "" ? "" : ("<" + args + ">"));
    }
    if (type instanceof UnionType)      return type.type1.toString() + " | " + type.type2.toString();
    if (type instanceof TypeArgument)   return type.pos.toString();
}

function getMaxArgPos(type: Type): number {
    if (type instanceof AliasInstantiation || type instanceof BaseType || type instanceof UnionType) 
        return Math.max(-1, ...type.typeArgs.map(getMaxArgPos));
    if (type instanceof TypeArgument)   return type.pos;
}

/**
 * Factors out union and alias types.
 */
function normalize(type: Type): (BaseType | TypeArgument)[] {
    if (type instanceof BaseType)           return [ type ];
    if (type instanceof AliasInstantiation) return normalize(type.getAliasedType());
    if (type instanceof UnionType)          return normalize(type.type1).concat(normalize(type.type2));
    if (type instanceof TypeArgument)       return [ type ];
}

/**
 * Factors out union and alias types and ensures that result has no type arguments.
 */
function normalizeClosed(type: Type): BaseType[] {
    var result = normalize(type); 
    if (result.some(n => n instanceof TypeArgument))
        throw new ImplementationError("Unexpected TypeArgument was found: Underlying type was not closed.");
    return result as BaseType[]; 
}

function isEquivalentTo(type: Type, other: Type) {
    if (type instanceof BaseType && other instanceof BaseType) {
        return type.baseType == other.baseType &&
            type.typeArgs.every((arg, i) => isEquivalentTo(arg, other.typeArgs[i]));
    }
    return isAssignableTo(type, other) && isAssignableTo(other, type);
}



function isAssignableTo(type: Type, other: Type): boolean {
    if (type instanceof BaseType && other instanceof BaseType) {
        //todo
    }

    const otherNormalized = normalizeClosed(other);
    return normalizeClosed(type).every(e => otherNormalized.some(o => 
        e.getAssignableTo().filter(t => isAssignableTo(t, o)).length > 0));
}