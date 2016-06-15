import { BaseTypeDefinition, TypeArgument, Type, BaseType, AliasTypeDefinition, UnionType } from "./types.ts";


interface TypeInfo {
    checkValue(value: string): boolean;
}

interface PrimitiveOrStringInfoProvider {
    getTypeInfo(type: BaseType): TypeInfo;
    getDefaultType(): BaseType;
}

function inferStringOrPrimitiveType(expectedType: Type, value: string, p: PrimitiveOrStringInfoProvider) {

    const r = expectedType
                .normalizeClosed()
                .map(t => ({ type: t, info: p.getTypeInfo(t) }))
                .filter(i => i.info != null);
    
    const accepted = r.filter(i => i.info.checkValue(value));
    if (accepted.length == 0) return p.getDefaultType();
    if (accepted.length == 1) return accepted[0].type;
    
    throw "cannot infer type";
}


export class TymlTypeInference {

    public readonly anyType = new BaseTypeDefinition("any", 0, []).close();
    public readonly primitiveType = new BaseTypeDefinition("primitive", 0, [this.anyType]).close();
    public readonly stringType = new BaseTypeDefinition("string", 0, [this.anyType]).close();
    public readonly objectType = new BaseTypeDefinition("object", 0, [this.anyType]).close();
    public readonly arrayDef = new BaseTypeDefinition("array", 1, [this.anyType]);
    public readonly interfaceType = new BaseTypeDefinition("array", 1, [this.anyType]).close();



    public inferStringType(expectedType: Type, value: string) {
        inferStringOrPrimitiveType(expectedType, value, {
        getTypeInfo: (type: BaseType) => {
            if (!type.getAssignableTo().some(t => t == this.stringType)) return null;
            return { checkValue: (value: string) => true };
        },
        getDefaultType: () => this.stringType
        });
    }

    public inferPrimitiveType(expectedType: Type, value: string) {
        inferStringOrPrimitiveType(expectedType, value, {
        getTypeInfo: (type: BaseType) => {
            if (!type.isAssignableTo(this.primitiveType)) return null;
            return { checkValue: (value: string) => true };
        },
        getDefaultType: () => this.primitiveType
        });
    }

    public inferObjectType(expectedType: Type, specifiedType?: BaseTypeDefinition) {
        if (specifiedType != undefined)
            return specifiedType.closeWithInferredArgs(expectedType);

        const r = expectedType
            .normalizeClosed()
            .filter(t => t.isAssignableTo(this.objectType));

        if (r.length == 1) return r[0];
        
        throw "cannot infer";
    }

    public inferArrayType(expectedType: Type) {
        const r = expectedType
            .normalizeClosed()
            .filter(t => t.getAssignableTo().some(t2 => t2.getBaseType() === this.arrayDef));

        if (r.length == 0) return this.arrayDef.close(this.anyType);
        if (r.length == 1) return r[0];

        throw "cannot infer";
    }
}