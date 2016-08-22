import { AmbiguityError, IncompatibilityError, CannotInferError, 
    ArgumentError, ImplementationError, single, selectMany, range } from "./utils";

/** Specifies the variance of a type parameter. */
export enum Variance {
    /** 
     * The type parameter is contravariant.
     * If the first type parameter of ConsumerOf is contravariant, ConsumerOf<Food> is assignable to ConsumerOf<Meat>, since Meat is assignable to Food, but not the other way round.
     * The assignability relations are opposite, thus "contra"-variant.
     */
    In, 
    
    /** 
     * The type parameter is covariant.
     * If the first type parameter of ConsumerOf is covariant, ProducerOf<Meat> is assignable to ProducerOf<Food>, since Meat is assignable to Food, but not the other way round.
     * The assignability relations are aligned, thus "co"-variant.
     */
    Out,
    
    /** 
     * The type parameter is invariant.
     * If the first type parameter of ConsumerAndProducerOf is invariant, ConsumerAndProducerOf<Meat> is neither assignable to ConsumerAndProducerOf<Food> nor to ConsumerAndProducerOf<Ham>.
     */ 
    InOut
}

export abstract class TypeDefinition {
    constructor(private name: string, private arity: number) {}

    public getArity() { return this.arity; }
    public toString() { return this.name; }
    public abstract close(...args: Type[]): Type;
}

export class CannotBeAssignableToAUnionTypeError extends ArgumentError { constructor() { super("cannot be assignable to a union type!"); } }

/** Each instance defines an unique base type. */
export class BaseTypeDefinition extends TypeDefinition {
    constructor(name: string, public typeParamVariances: Variance[], public directlyAssignableTo: DefinitionInstantiation[]) {  
        super(name, typeParamVariances.length);
        if (directlyAssignableTo.some(t => getMaxArgPos(t) >= this.getArity()))
            throw new ArgumentError("invalid arity in type argument");

        directlyAssignableTo.forEach(t => {
            const normalized = single(t.normalizeClosed(), ImplementationError, CannotBeAssignableToAUnionTypeError); 
            BaseTypeDefinition.ensureParamVariances(normalized, typeParamVariances);
        }); 
    }

    /** 
     * ensures that type parameters are not used as arguments for other types which require a non compatible variance
     * Example: ensureParamVariances(ConsumerOf<0|Vegtables>, [Out]) fails if the first argument of Consumer is contravariant.
     */
    private static ensureParamVariances(type: BaseType, typeParamVariances: Variance[]) {
        type.typeArgs.forEach((providedArg, idx) => {
            var expectedParamVariance = type.definition.typeParamVariances[idx];

            providedArg.normalize().forEach(normalizedArg => { 
                if (normalizedArg.isTypeParameter()) {
                    var actualParamVariance = typeParamVariances[normalizedArg.pos];
                    
                    if (actualParamVariance != expectedParamVariance && actualParamVariance != Variance.InOut)
                        throw new ArgumentError(`Invariance violated! Type-parameter ${ normalizedArg.pos } with variance ${ 
                            actualParamVariance } must be compatible to variance ${ expectedParamVariance }.`);
                }
                else if (normalizedArg.isBaseType()) {
                    BaseTypeDefinition.ensureParamVariances(normalizedArg, typeParamVariances);
                }
            });
        });
    }

    public close(...args: Type[]) { return new BaseType(this, args); }
    
    public closeWithInferredArgs(expectedType: Type): Type {
        const argVars = range(this.getArity()).map(i => new TypeParameter(i));
        const assignableTo = this.close(...argVars).getBaseTypesAssignableTo();

        var matchings = selectMany(expectedType.normalizeClosed(), curExp => 
            assignableTo
                .filter(t => t.definition === curExp.definition)
                .map(t => ({ given: t, expected: curExp }))
        );
        const { given, expected } = single(matchings, IncompatibilityError, AmbiguityError);

        const args =  range(this.getArity()).map<Type|undefined>(i => undefined);
        BaseTypeDefinition.unify(given, expected, args);
        let idx = 0;
        const result = this.close(...args.map(t => t || new TypeParameter(idx++)));
        return result;
    }

    private static unify(openType: Type, closedType: Type, typeArgs: (Type|undefined)[]) {
        const normalizedOpenType = single(openType.normalize(), CannotInferError);
        if (normalizedOpenType.isTypeParameter()) {
            const oldValue = typeArgs[normalizedOpenType.pos];
            if (oldValue == undefined) 
                typeArgs[normalizedOpenType.pos] = closedType;
            else if (!isEquivalentTo(oldValue, closedType))
                throw new IncompatibilityError();
        }
        else if (normalizedOpenType.isBaseType()) {
            const normalizedClosedType = single(closedType.normalizeClosed(), CannotInferError);
            if (normalizedOpenType.definition != normalizedClosedType.definition)
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


export abstract class Type {
    public isUnionType(): this is UnionType { return this instanceof UnionType; }
    public isTypeParameter(): this is TypeParameter { return this instanceof TypeParameter; }
    public isBaseType(): this is BaseType { return this instanceof BaseType; }
    public isAliasInstantiation(): this is AliasInstantiation { return this instanceof AliasInstantiation; }

    /** Returns a string representation of the "type" argument. */
    public toString(): string {
        const self = this;
        if (self.isBaseType() || self.isAliasInstantiation()) {
            let args = self.typeArgs.map(t => t.toString()).join(", ");
            return self.definition.toString() + (args == "" ? "" : ("<" + args + ">"));
        }
        if (self.isUnionType())      return self.type1.toString() + " | " + self.type2.toString();
        if (self.isTypeParameter())   return self.pos.toString();
        throw Error("Unknown type");
    }

    /**
     * Factors out union and alias types.
     * Example: If AOrB<0,1> is an alias type for 0|1, normalize(AOrB<string, chocolate|AOrB(ham, water)>) returns [string, chocolate, ham, water]. 
     */
    public normalize(): (BaseType|TypeParameter)[] {
        const self = this;
        if (self.isBaseType() || self.isTypeParameter()) return [ self ];
        if (self.isAliasInstantiation()) return self.getAliasedType().normalize();
        if (self.isUnionType())          return self.type1.normalize().concat(self.type2.normalize());
        throw Error("Unknown type");
    }

    public normalizeClosed(): BaseType[] {
        const normalized = this.normalize();
        if (normalized.some(n => n instanceof TypeParameter)) 
            throw new ArgumentError("Type is not closed!");
        return normalized as BaseType[];
    }

    public typeArgs: Type[];

    // method only used so that open type can be used as closed type.

    /**
     * Checks wether "type" is assignable to "other". "type" and "other" must not contain any type parameters, i.e. must be fully closed types.
     * This method is private and only callable when casted to FullyClosedType interface.
     */
    public isAssignableTo(other: Type): boolean {
        const self = this;
        
        if (self.isBaseType() && other.isBaseType()) {
            if (self.definition == other.definition)
                return self.typeArgs.every((arg, idx) => 
                    checkVariance(arg, other.typeArgs[idx], self.definition.typeParamVariances[idx]));
            
            return self.getDirectlyAssignableTo().some(t => t.isAssignableTo(other));
        }

        // If type 
        return self.normalize().every(t => other.normalize().some(o => t.isAssignableTo(o))); 
    }
}

export abstract class DefinitionInstantiation extends Type {
    constructor(definition: TypeDefinition, public typeArgs: Type[]) {
        super();
        if (definition.getArity() != typeArgs.length) throw new ArgumentError("invalid arity");
    }
}

export class BaseType extends DefinitionInstantiation {
    constructor(public definition: BaseTypeDefinition, typeArgs: Type[]) { super(definition, typeArgs); }

    public getDirectlyAssignableTo(): DefinitionInstantiation[] {
        return this.definition.directlyAssignableTo.map(t => insert(t, this.typeArgs));
    }

    public getBaseTypesDirectlyAssignableTo(): BaseType[] {
        return this.getDirectlyAssignableTo().map(t => single(t.normalizeClosed(), ImplementationError));
    }

    public getBaseTypesAssignableTo(): BaseType[] {
        return selectMany(this.getBaseTypesDirectlyAssignableTo(), t => {
            return [ t ].concat(t.getBaseTypesAssignableTo());
        });
    }
}

export class AliasInstantiation extends DefinitionInstantiation {
    constructor(public definition: AliasTypeDefinition, typeArgs: Type[]) { super(definition, typeArgs); }

    public getAliasedType(): Type { return insert(this.definition.aliasedType, this.typeArgs); }
}

export class UnionType extends Type {
    constructor(public type1: Type, public type2: Type) { super(); }
    
    public get typeArgs(): Type[] { return [ this.type1, this.type2 ]; } 
}

export class TypeParameter extends Type {
    constructor(public pos: number) {
        super();
        if (pos < 0) throw new ArgumentError("id must be non negative"); 
    }

    public get typeArgs(): Type[] { return [ ]; } 
}

// Private Implementation from here

/** 
 * Replaces type parameters in "type" with arguments from "args".
 * Example: insert(Dictionary<0, Producer<1|2>>, [string, meat, chocolate]) returns Dictionary<string, Producter<meat|chocolate>>. 
 */
function insert(type: Type, args: Type[]): Type {
    if (type.isBaseType())           return new BaseType(type.definition, insertMany(type.typeArgs, args));
    if (type.isAliasInstantiation()) return new AliasInstantiation(type.definition, insertMany(type.typeArgs, args));
    if (type.isUnionType())          return new UnionType(insert(type.type1, args), insert(type.type2, args));
    if (type.isTypeParameter())       return (type.pos < args.length) ? args[type.pos] : type;
    throw Error("Unknown type");
}

/** Replaces type parameters of all elements in "types" with arguments from "args". */
function insertMany(types: Type[], args: Type[]): Type[] { return types.map(t => insert(t, args)); }

/** 
 * Returns the highest position of all type parameters used in "type". 
 * Example: getMaxArgPos(Dictionary<0, Producer<1>>) is 1.
*/
function getMaxArgPos(type: Type): number {
    if (type.isAliasInstantiation() || type.isBaseType() || type.isUnionType()) 
        return Math.max(-1, ...type.typeArgs.map(getMaxArgPos));
    if (type.isTypeParameter())   return type.pos;
    throw Error("Unknown type");
}

/**
 * Checks whether type is assignable to other and other assignable to type.
 * Example: Meat|Ham is equivalent to Meat, because Meat and Ham are both assignable to Meat, and Meat is assignable to Meat.
 */
function isEquivalentTo(type: Type, other: Type): boolean {
    return checkVariance(type, other, Variance.InOut);
}

/**
 * Checks wether "type" and "other" comply with a given variance.
 */
function checkVariance(type: Type, other: Type, variance: Variance): boolean {
    if (variance == Variance.In) return other.isAssignableTo(type);
    if (variance == Variance.Out) return type.isAssignableTo(other);
    return type.isAssignableTo(other) && other.isAssignableTo(type);
}
