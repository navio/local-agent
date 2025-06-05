/**
 * @fileoverview
 * Centralized configuration service for loading and validating config files.
 */
import { readFileSync } from 'fs';
import { 
  GenerateTextParamsSchema, 
  ToolsJsonSchema, 
  KeysJsonSchema 
} from '../types';
import { ConfigurationError } from '../errors';

/**
 * Service for loading and validating configuration files.
 */
export class ConfigService {
  /**
   * Loads and validates the main agent configuration.
   * 
   * @param filePath Path to the configuration file
   * @returns Parsed and validated configuration
   * @throws ConfigurationError if file is invalid or missing
   */
  static loadConfig(filePath: string): any {
    try {
      const configData = JSON.parse(readFileSync(filePath, 'utf8'));
      return GenerateTextParamsSchema.parse(configData);
    } catch (err) {
      if (err instanceof Error && err.message.includes('ENOENT')) {
        throw new ConfigurationError(`Configuration file not found: ${filePath}`);
      }
      throw new ConfigurationError(`Invalid configuration in ${filePath}: ${err}`);
    }
  }
  
  /**
   * Loads and validates the tools configuration.
   * 
   * @param filePath Path to the tools configuration file
   * @returns Parsed and validated tools configuration
   * @throws ConfigurationError if file is invalid or missing
   */
  static loadTools(filePath: string): any {
    try {
      const toolsData = JSON.parse(readFileSync(filePath, 'utf8'));
      return ToolsJsonSchema.parse(toolsData);
    } catch (err) {
      if (err instanceof Error && err.message.includes('ENOENT')) {
        throw new ConfigurationError(`Tools configuration file not found: ${filePath}`);
      }
      throw new ConfigurationError(`Invalid tools configuration in ${filePath}: ${err}`);
    }
  }
  
  /**
   * Loads and validates the API keys configuration.
   * 
   * @param filePath Path to the keys configuration file
   * @returns Parsed and validated keys configuration
   * @throws ConfigurationError if file is invalid or missing
   */
  static loadKeys(filePath: string): any {
    try {
      const keysData = JSON.parse(readFileSync(filePath, 'utf8'));
      return KeysJsonSchema.parse(keysData);
    } catch (err) {
      if (err instanceof Error && err.message.includes('ENOENT')) {
        throw new ConfigurationError(`Keys configuration file not found: ${filePath}`);
      }
      throw new ConfigurationError(`Invalid keys configuration in ${filePath}: ${err}`);
    }
  }
}