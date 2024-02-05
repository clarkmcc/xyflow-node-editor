import { CSSProperties, JSXElementConstructor } from 'react'
import {
  BaseInputProps,
  getBuiltinInputs,
  InputSlots,
} from './components/inputs.ts'

export const ANY = '__any'

export interface IGraphConfig {
  /**
   * Keybindings for the graph editor
   */
  keybindings?: KeyBindings

  /**
   * Configures the different types of values supported by the node inputs and outputs
   */
  valueTypes: ValueTypes

  /**
   * Groups of nodes that can be used to organize the node palette, allowing styling
   * and configuring the colors of the nodes as a group.
   */
  nodeThemes: NodeThemeTypes

  /**
   * The nodes types that are registered and can be created in the graph
   */
  nodeTypes: NodeTypes
}

export type KeyBindings = {
  save: string[]
  copy: string[]
  paste: string[]
  delete: string[]
}

export type ValueTypes = {
  [key: string]: ValueTypeConfig
}

export type NodeThemeTypes = {
  [name: string]: NodeThemeConfig
}

export type NodeTypes = {
  [key: string]: NodeConfig
}

/**
 * The different types of values that can be used for node inputs and outputs.
 */
interface ValueTypeConfigBase {
  name: string
  color: string
  /**
   * The shape to use for the input/output handle attached to the node.
   */
  shape?: 'diamond' | 'diamondDot' | 'circle'
  /**
   * Indicates that this is a custom input element and should not be rendered using
   * the config-based rendering system
   */
  custom?: boolean
}

export interface ValueTypeConfigOptions extends ValueTypeConfigBase {
  inputEditor: 'options' | 'buttonGroup'
  options: Option[]
  defaultValue: Option['value'] // Ensures defaultValue is one of the option values
}

interface ValueTypeConfigValue extends ValueTypeConfigBase {
  inputEditor: 'value'
  defaultValue: string // Ensures defaultValue is a string
}

interface ValueTypeConfigCheckbox extends ValueTypeConfigBase {
  inputEditor: 'checkbox'
  defaultValue: boolean // Ensures defaultValue is a boolean
}

interface ValueTypeConfigCustom extends ValueTypeConfigBase {
  inputEditor: string
}

interface ValueTypeConfigNoInput extends ValueTypeConfigBase {
  inputEditor: null | undefined
}

export type ValueTypeConfig =
  | ValueTypeConfigOptions
  | ValueTypeConfigValue
  | ValueTypeConfigCheckbox
  | ValueTypeConfigNoInput
  | ValueTypeConfigCustom

export interface Option {
  name: string
  value: string
}

export interface NodeThemeConfig {
  name: string
  color: string
}

export interface NodeConfig {
  theme: keyof IGraphConfig['nodeThemes']
  name: string
  inputs?: NodeInputConfig[]
  outputs?: NodeOutputConfig[]
  /**
   * These styles are applied to the node's div element. This can be used to
   * configure node widths, background, etc.
   */
  style?: CSSProperties
  /**
   * Node is a custom node and should not be rendered using the config-based
   * rendering system
   */
  custom?: boolean
}

export interface NodeInputConfig {
  name: string
  id: string
  valueType: Extract<keyof ValueTypes, string>
  isArray?: boolean
  defaultValue?: any
  isConstant?: boolean
  /**
   * The group that this input belongs to. When specified, this input and
   * any other inputs with this group name will be rendered under a collapsable
   * accordion.
   */
  inputGroup?: string
}

export interface NodeOutputConfig {
  name: string
  id: string
  valueType: string
  isArray?: boolean
}

function isValueTypeConfigOptions(
  config: ValueTypeConfig,
): config is ValueTypeConfigOptions {
  return (
    config.inputEditor === 'options' || config.inputEditor === 'buttonGroup'
  )
}

function isValueTypeConfigValue(
  config: ValueTypeConfig,
): config is ValueTypeConfigValue {
  return config.inputEditor === 'value'
}

function isValueTypeConfigCheckbox(
  config: ValueTypeConfig,
): config is ValueTypeConfigCheckbox {
  return config.inputEditor === 'checkbox'
}

type WithType<T, K> = T & {
  type: K
}

export type InputProps = BaseInputProps & NodeInputConfig & ValueTypeConfig

export class GraphConfig {
  readonly valueTypes: ValueTypes = {}
  readonly keybindings: KeyBindings
  readonly nodeThemes: {
    [key: string]: NodeThemeConfig
  } = {}
  private readonly nodeTypes: {
    [key: string]: NodeConfig
  } = {}
  private customNodes: {
    [key: string]: JSXElementConstructor<any>
  } = {}
  private inputs: {
    [key: string]: JSXElementConstructor<any>
  } = {}

  constructor(props?: Partial<IGraphConfig>) {
    this.keybindings = {
      save: ['meta+s'],
      copy: ['meta+c'],
      paste: ['meta+v'],
      delete: ['x', 'Backspace', 'Delete'],
      ...props?.keybindings,
    }
    this.valueTypes = props?.valueTypes ?? this.valueTypes
    this.valueTypes[ANY] = {
      name: 'Any',
      color: '#a1a1a1',
      inputEditor: null,
    }
    this.nodeThemes = props?.nodeThemes ?? this.nodeThemes
    this.nodeTypes = props?.nodeTypes ?? this.nodeTypes
    for (const [key, value] of Object.entries(getBuiltinInputs())) {
      this.inputs[key] = value
    }
  }

  validate(): GraphConfig {
    const errors: string[] = []
    Object.values(this.nodeTypes).forEach((node) => {
      if (node.inputs) {
        node.inputs.forEach((input) => {
          if (!this.valueTypes[input.valueType]) {
            errors.push(
              `Node '${node.name}' has an input that references non-existent value type '${input.valueType}'`,
            )
          }
        })
      }
      if (node.outputs) {
        node.outputs.forEach((output) => {
          if (!this.valueTypes[output.valueType]) {
            errors.push(
              `Node '${node.name}' has an output that references non-existent value type '${output.valueType}'`,
            )
          }
        })
      }
    })
    if (errors.length > 0) {
      throw new Error(errors.join('\n'))
    }
    return this
  }

  registerCustomNode<T>(
    name: string,
    type: string,
    theme: string,
    node: JSXElementConstructor<T>,
    inputs: NodeInputConfig[],
    outputs: NodeOutputConfig[],
  ) {
    this.customNodes[type] = node
    this.nodeTypes[type] = {
      theme: theme,
      name,
      inputs: inputs,
      outputs: outputs,
      custom: true,
    }
    this.validate()
  }

  registerInput(
    type: string,
    input: JSXElementConstructor<InputProps>,
    valueType: Omit<ValueTypeConfig, 'inputEditor'>,
  ) {
    this.inputs[type] = input
    this.valueTypes[type] = {
      ...valueType,
      inputEditor: type,
    }
    this.validate()
  }

  customNode<T>(type: string): JSXElementConstructor<T> {
    return this.customNodes[type]
  }

  /**
   * Accepts a value type and returns the input component that should be used to
   * render the input for that value type.
   * @param valueType
   */
  getInputComponent(
    valueType: string,
  ): JSXElementConstructor<InputProps & { slots?: InputSlots }> | null {
    const inputEditor = this.valueTypes[valueType]?.inputEditor
    if (inputEditor == null) return null
    return this.inputs[inputEditor]
  }

  nodeConfigs(): WithType<NodeConfig, string>[] {
    return Object.entries(this.nodeTypes).map(([type, value]) => ({
      ...value,
      type,
    }))
  }

  getNodeConfig(type: string): NodeConfig {
    return this.nodeTypes[type]
  }

  nodeConfigsByTheme(theme: string): WithType<NodeConfig, string>[] {
    return Object.entries(this.nodeTypes)
      .map(([type, n]) => ({ type, ...n }))
      .filter((n) => n.theme === theme)
  }

  nodeThemeConfigs(): WithType<NodeThemeConfig, string>[] {
    return Object.entries(this.nodeThemes).map(([type, value]) => ({
      ...value,
      type,
    }))
  }

  getRegisteredNodeTypes() {
    return Object.entries(this.nodeThemes).map(([type, theme]) => ({
      type,
      name: theme.name,
      nodes: this.nodeConfigsByTheme(type).map((node) => ({
        type: node.type,
        name: node.name,
      })),
    }))
  }

  getNodeThemeConfig<T extends keyof this['nodeThemes']>(
    nodeType: T,
  ): NodeThemeConfig {
    return this.nodeThemes[nodeType as keyof NodeThemeTypes]
  }

  valueType<T extends keyof this['valueTypes']>(type: T): ValueTypeConfig {
    const config = this.valueTypes[type as Extract<keyof ValueTypes, string>]
    if (config == null)
      console.error(
        `No value type config for '${String(type)}'. Registered value types:`,
        this.valueTypes,
      )
    if (isValueTypeConfigOptions(config)) {
      return config as ValueTypeConfigOptions
    } else if (isValueTypeConfigValue(config)) {
      return config as ValueTypeConfigValue
    } else if (isValueTypeConfigCheckbox(config)) {
      return config as ValueTypeConfigCheckbox
    }
    return config
  }

  getInputConfig(input: NodeInputConfig): NodeInputConfig & ValueTypeConfig {
    return {
      ...this.valueType(input.valueType),
      ...input,
    }
  }

  getOutputConfig(
    output: NodeOutputConfig,
  ): NodeOutputConfig & ValueTypeConfig {
    return {
      ...this.valueType(output.valueType),
      ...output,
    }
  }

  getNodeComponents(
    buildNode: (
      config: GraphConfig,
      node: NodeConfig,
    ) => JSXElementConstructor<any>,
  ): Record<string, JSXElementConstructor<any>> {
    return Object.entries(this.nodeTypes)
      .map(([type, node]): [string, JSXElementConstructor<any>] => {
        if (node.custom) {
          return [type, this.customNode(type)]
        } else {
          return [type, buildNode(this, node)]
        }
      })
      .reduce(
        (acc: Record<string, JSXElementConstructor<any>>, [type, node]) => {
          acc[type] = node
          return acc
        },
        {},
      )
  }
}
