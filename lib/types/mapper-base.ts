/**
 * @fileoverview Defines the base mapper interfaces and abstract classes for
 * converting between domain entities and database representations.
 */

/**
 * Generic mapper interface for converting between domain entities and database types.
 *
 * @template DomainType - The domain entity type
 * @template DbType - The database representation type
 */
export interface IEntityMapper<DomainType, DbType> {
  /**
   * Convert a database representation to a domain entity.
   *
   * @param dbEntity - Database entity to convert
   * @returns Domain entity
   */
  toDomain(dbEntity: DbType): DomainType;
  
  /**
   * Convert a domain entity to a database representation.
   *
   * @param domainEntity - Domain entity to convert
   * @returns Database representation
   */
  toDatabase(domainEntity: DomainType): DbType;
  
  /**
   * Convert a list of database entities to domain entities.
   *
   * @param dbEntities - List of database entities
   * @returns List of domain entities
   */
  toDomainList(dbEntities: DbType[]): DomainType[];
  
  /**
   * Convert a list of domain entities to database entities.
   *
   * @param domainEntities - List of domain entities
   * @returns List of database entities
   */
  toDatabaseList(domainEntities: DomainType[]): DbType[];
}

/**
 * Abstract base mapper that provides default implementations for list conversions.
 *
 * @template DomainType - The domain entity type
 * @template DbType - The database representation type
 */
export abstract class BaseEntityMapper<DomainType, DbType> implements IEntityMapper<DomainType, DbType> {
  /**
   * Abstract method to be implemented by concrete mappers.
   */
  abstract toDomain(dbEntity: DbType): DomainType;
  
  /**
   * Abstract method to be implemented by concrete mappers.
   */
  abstract toDatabase(domainEntity: DomainType): DbType;
  
  /**
   * Default implementation that maps each entity in the list.
   *
   * @param dbEntities - List of database entities
   * @returns List of domain entities
   */
  toDomainList(dbEntities: DbType[]): DomainType[] {
    return dbEntities.map(entity => this.toDomain(entity));
  }
  
  /**
   * Default implementation that maps each entity in the list.
   *
   * @param domainEntities - List of domain entities
   * @returns List of database entities
   */
  toDatabaseList(domainEntities: DomainType[]): DbType[] {
    return domainEntities.map(entity => this.toDatabase(entity));
  }
  
  /**
   * Safely handle null or undefined values.
   *
   * @param entity - Entity that might be null or undefined
   * @param mapFn - Mapping function to apply if entity exists
   * @returns Mapped entity or null
   */
  protected mapNullable<T, R>(
    entity: T | null | undefined,
    mapFn: (e: T) => R
  ): R | null {
    return entity !== null && entity !== undefined ? mapFn(entity) : null;
  }
}

/**
 * Interface for value mappers that handle simple value conversions.
 *
 * @template DomainType - The domain value type
 * @template DbType - The database value type
 */
export interface IValueMapper<DomainType, DbType> {
  /**
   * Convert a database value to a domain value.
   */
  toDomain(dbValue: DbType): DomainType;
  
  /**
   * Convert a domain value to a database value.
   */
  toDatabase(domainValue: DomainType): DbType;
}

/**
 * A mapper for converting between domain enums and database string literals.
 *
 * @template DomainEnum - The domain enum type
 * @template DbEnum - The database enum type
 */
export abstract class EnumMapper<DomainEnum, DbEnum> implements IValueMapper<DomainEnum, DbEnum> {
  protected abstract readonly domainToDbMap: Map<DomainEnum, DbEnum>;
  protected abstract readonly dbToDomainMap: Map<DbEnum, DomainEnum>;
  protected abstract readonly defaultDomainValue: DomainEnum;
  protected abstract readonly defaultDbValue: DbEnum;
  
  /**
   * Convert a database enum value to a domain enum value.
   *
   * @param dbValue - Database enum value
   * @returns Domain enum value
   */
  toDomain(dbValue: DbEnum): DomainEnum {
    const mappedValue = this.dbToDomainMap.get(dbValue);
    return mappedValue ?? this.defaultDomainValue;
  }
  
  /**
   * Convert a domain enum value to a database enum value.
   *
   * @param domainValue - Domain enum value
   * @returns Database enum value
   */
  toDatabase(domainValue: DomainEnum): DbEnum {
    const mappedValue = this.domainToDbMap.get(domainValue);
    return mappedValue ?? this.defaultDbValue;
  }
}