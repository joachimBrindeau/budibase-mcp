export interface BudibaseApp {
  _id: string;
  _rev?: string;
  _metadataId?: string;
  _idCorrected?: boolean;
  name: string;
  url?: string;
  status: 'development' | 'published';
  createdAt: string;
  updatedAt: string;
  template?: string;
  tenantId?: string;
  instance?: {
    _id: string;
  };
}

export interface BudibaseTable {
  _id: string;
  name: string;
  schema: Record<string, BudibaseField>;
  type: 'table' | 'view';
  primaryDisplay?: string;
  sourceId?: string;
  sql?: boolean;
  views?: Record<string, any>;
}

export interface BudibaseField {
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'attachment' | 'link' | 'formula' | 'auto' | 'json';
  name: string;
  constraints?: {
    type?: 'string' | 'number';
    presence?: boolean;
    length?: { maximum?: number; minimum?: number };
    numericality?: { greaterThan?: number; lessThan?: number };
  };
  relationshipType?: 'one-to-many' | 'many-to-one' | 'many-to-many';
  tableId?: string;
  fieldName?: string;
}

export interface BudibaseRecord {
  _id: string;
  _rev?: string;
  tableId: string;
  [key: string]: any;
}
export interface BudibaseUser {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: 'active' | 'inactive';
  roles: Record<string, string>;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface QueryRequest {
  tableId: string;
  query?: {
    string?: Record<string, string>;
    fuzzy?: Record<string, string>;
    range?: Record<string, { low?: number; high?: number }>;
    equal?: Record<string, any>;
    notEqual?: Record<string, any>;
    empty?: Record<string, boolean>;
    notEmpty?: Record<string, boolean>;
  };
  sort?: {
    [field: string]: 'ascending' | 'descending';
  };
  limit?: number;
  bookmark?: string;
}

export interface QueryResponse {
  data: BudibaseRecord[];
  bookmark?: string;
  hasNextPage: boolean;
}

export interface BudibaseQuery {
  _id: string;
  name: string;
  datasourceId: string;
  parameters: any[];
  fields: any;
  queryVerb: string;
  transformer?: string;
  schema?: any;
  readable: boolean;
}

