/**
 * Type declarations for optional dependencies
 * These modules may not be installed in all environments
 */

// Type declaration for 'open' module
declare module 'open' {
  interface Options {
    wait?: boolean;
    background?: boolean;
    newInstance?: boolean;
    allowNonzeroExitCode?: boolean;
    app?: {
      name: string | readonly string[];
      arguments?: readonly string[];
    };
  }

  function open(target: string, options?: Options): Promise<any>;

  export = open;
}

// Type declaration for 'keytar' module
declare module 'keytar' {
  export function setPassword(service: string, account: string, password: string): Promise<void>;
  export function getPassword(service: string, account: string): Promise<string | null>;
  export function deletePassword(service: string, account: string): Promise<boolean>;
  export function findPassword(service: string): Promise<string | null>;
  export function findCredentials(service: string): Promise<Array<{ account: string; password: string }>>;
}
