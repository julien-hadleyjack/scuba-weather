// vitest-axe 0.1 only declares its matcher on the old global `Vi` namespace.
// Declaration merging needs the original shape: empty interfaces, same type parameter.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
import type { AxeMatchers } from 'vitest-axe';

declare module 'vitest' {
  interface Assertion<T> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
