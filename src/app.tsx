import { DistinctType, TypeArgument, Type } from "./types.ts";

const v = (id: number) => new TypeArgument(id);

const any = new DistinctType("any", 0, []);
const object = new DistinctType("object", 0, [any.close()]);

const bucket = new DistinctType("bucket", 1, [object.close()]);

const str = new DistinctType("string", 0, []);

const enumerable = new DistinctType("enumerable", 1, [object.close()]);
const collection = new DistinctType("collection", 1, [enumerable.close(v(1))]);
const list = new DistinctType("list", 1, [collection.close(v(1)), collection.close(bucket.close(v(1)))]);


const listOfStr = list.close(str.close());

console.log(listOfStr.assignableTo().map(t => t.toString()));


function infer(expectedType: Type, givenType: DistinctType) {
	
}

infer(enumerable.close(bucket.close(str.close())), list);

