import { Document, Model, Query } from 'mongoose';

export interface QueryString {
  page?: string;
  sort?: string;
  limit?: string;
  fields?: string;
  [key: string]: any;
}

export class APIFeatures<T extends Document> {
  public query: Query<T[], T>;
  public queryString: QueryString;

  constructor(query: Query<T[], T>, queryString: QueryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Advanced filtering: only allow safe MongoDB operators
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    // Parse and sanitize — strip any disallowed $ operators to prevent NoSQL injection
    const parsed = JSON.parse(queryStr);
    const sanitized = this._stripUnsafeOperators(parsed);

    this.query = this.query.find(sanitized);
    return this;
  }

  /**
   * Recursively remove MongoDB operators that are NOT in the safe whitelist.
   * Prevents injection of $ne, $regex, $where, $or, $and, etc.
   */
  private _stripUnsafeOperators(obj: any): any {
    const SAFE_OPS = new Set(['$gte', '$gt', '$lte', '$lt']);

    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this._stripUnsafeOperators(item));

    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') && !SAFE_OPS.has(key)) {
        // Skip dangerous operators
        continue;
      }
      cleaned[key] = this._stripUnsafeOperators(obj[key]);
    }
    return cleaned;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryString.page || '1', 10);
    const limit = parseInt(this.queryString.limit || '10', 10);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}
