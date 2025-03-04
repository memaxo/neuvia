# TypeScript Type System Documentation

This directory contains comprehensive documentation for the Neuvia app's TypeScript type system standardization efforts.

## Contents

1. [**Type Analysis**](./type-analysis.md) - Comprehensive analysis of current type definitions, relationships, and issues
2. [**Style Guide**](./style-guide.md) - Definitive guide for TypeScript type naming, organization, and best practices
3. [**Type Dependencies**](./type-dependencies.md) - Visualization of type relationships and inheritance hierarchies
4. [**Migration Plan**](./migration-plan.md) - Phased plan for standardizing types across the codebase

## TypeScript Standards Summary

Our TypeScript type system follows these key principles:

1. **Single Source of Truth**
   - Each type has one canonical definition in `/lib/types/{domain}.ts`
   - Types are exported through barrel exports in `/lib/types/index.ts`

2. **Consistent Naming**
   - PascalCase for interfaces, types, and enums
   - UPPERCASE for enum values
   - camelCase for properties and methods
   - Consistent naming patterns for related types

3. **Type Safety**
   - Avoid `any` - use `unknown` with type guards
   - Use discriminated unions for better type checking
   - Add runtime validation with Zod schemas
   - Create proper type guards for type narrowing

4. **Documentation**
   - Add JSDoc comments to all exported types
   - Include examples for complex interfaces
   - Document type relationships and inheritance
   - Add deprecation notices with migration paths

## Getting Started

If you're new to the Neuvia codebase, start with the [Style Guide](./style-guide.md) to understand our TypeScript conventions. The [Type Dependencies](./type-dependencies.md) document will help you understand how types relate to each other across the system.

For a detailed understanding of the type system, see the [Type Analysis](./type-analysis.md) document, which provides a comprehensive overview of all type definitions and their relationships.

If you're working on type-related improvements, refer to the [Migration Plan](./migration-plan.md) for guidance on our standardization approach and timeline.