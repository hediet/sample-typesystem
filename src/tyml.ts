import { Variance, BaseTypeDefinition, TypeParameter, Type, BaseType, AliasTypeDefinition, UnionType } from "./types";
import { ImplementationError, AmbiguityError, IncompatibilityError, ArgumentError, single } from "./utils";

export type ValuePredicate = (type: BaseType, value: string) => boolean;

export class TymlTypeInference {

    public static anyType = new BaseTypeDefinition("any", [], []).close();
    public static primitiveType = new BaseTypeDefinition("primitive", [], [TymlTypeInference.anyType]).close();
    public static stringType = new BaseTypeDefinition("string", [], [TymlTypeInference.anyType]).close();
    public static objectType = new BaseTypeDefinition("object", [], [TymlTypeInference.anyType]).close();
    public static arrayDef = new BaseTypeDefinition("array", [Variance.Out], [TymlTypeInference.anyType]);

    constructor(private stringValuePredicate: ValuePredicate, 
                private primitiveValuePredicate: ValuePredicate) { }    

    private inferLiteralType(expectedType: Type, value: string, 
        valuePredicate: ValuePredicate, baseType: Type) {
        const accepted = expectedType
            .normalizeClosed()
            .filter(type => valuePredicate(type, value));
        var t = single(accepted, IncompatibilityError, AmbiguityError);
        if (baseType.isAssignableTo(t)) return baseType;
        return t;
    }

    public inferStringType(expectedType: Type, value: string) {
        return this.inferLiteralType(expectedType, value, 
            this.stringValuePredicate, TymlTypeInference.stringType)
    }

    public inferPrimitiveType(expectedType: Type, value: string) {
        return this.inferLiteralType(expectedType, value, 
            this.primitiveValuePredicate, TymlTypeInference.primitiveType);
    }

    public inferObjectType(expectedType: Type, specifiedType?: BaseTypeDefinition) {
        if (specifiedType != undefined)
            return specifiedType.closeWithInferredArgs(expectedType);

        const objectTypes = expectedType
            .normalizeClosed()
            .filter(t => t.isAssignableTo(TymlTypeInference.objectType));
        return single(objectTypes, IncompatibilityError, AmbiguityError);
    }

    public inferArrayType(expectedType: Type) {
        const compatible = expectedType
            .normalizeClosed()
            .filter(t => t == TymlTypeInference.anyType ||
                t.getBaseTypesAssignableTo().some(t2 => t2.definition === TymlTypeInference.arrayDef));
        const result = single(compatible, IncompatibilityError, AmbiguityError);
        if (result == TymlTypeInference.anyType)
            return TymlTypeInference.arrayDef.close(TymlTypeInference.anyType);
        return result;
    }

    public getArrayItemType(arrayType: Type) {
        var arrType = single(arrayType.normalizeClosed(), ArgumentError);
        var arrInst = single(arrType.getBaseTypesAssignableTo()
            .filter(a => a.definition == TymlTypeInference.arrayDef), ArgumentError);
        return single(arrInst.typeArgs, ImplementationError);
    }
}