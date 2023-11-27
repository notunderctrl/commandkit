import type { CommandHandlerData, CommandHandlerOptions } from './typings';
import type { CommandFileObject, ReloadOptions } from '../../typings';

import { toFileURL } from '../../utils/resolve-file-url';
import { getFilePaths } from '../../utils/get-paths';

import loadCommandsWithRest from './functions/loadCommandsWithRest';
import registerCommands from './functions/registerCommands';
import builtInValidations from './validations';
import colors from '../../utils/colors';
import { clone } from '../../utils/clone';

/**
 * A handler for client application commands.
 */
export class CommandHandler {
    #data: CommandHandlerData;

    constructor({ ...options }: CommandHandlerOptions) {
        this.#data = {
            ...options,
            builtInValidations: [],
            commands: [],
        };
    }

    async init() {
        await this.#buildCommands();

        this.#buildValidations();

        const devOnlyCommands = this.#data.commands.filter((cmd) => cmd.options?.devOnly);

        if (devOnlyCommands.length && !this.#data.devGuildIds.length) {
            console.log(
                colors.yellow(
                    'ℹ️ Warning: You have commands marked as "devOnly" but "devGuildIds" has not been set.',
                ),
            );
        }

        if (
            devOnlyCommands.length &&
            !this.#data.devUserIds.length &&
            !this.#data.devRoleIds.length
        ) {
            console.log(
                colors.yellow(
                    'ℹ️ Warning: You have commands marked as "devOnly" but not "devUserIds" or "devRoleIds" were set.',
                ),
            );
        }

        if (this.#data.bulkRegister) {
            await loadCommandsWithRest({
                client: this.#data.client,
                devGuildIds: this.#data.devGuildIds,
                commands: this.#data.commands,
            });
        } else {
            await registerCommands({
                client: this.#data.client,
                devGuildIds: this.#data.devGuildIds,
                commands: this.#data.commands,
            });
        }

        this.handleCommands();
    }

    async #buildCommands() {
        const allowedExtensions = /\.(js|mjs|cjs|ts)$/i;
        const paths = await getFilePaths(this.#data.commandsPath, true);

        const commandFilePaths = paths.filter((path) => allowedExtensions.test(path));

        for (const commandFilePath of commandFilePaths) {
            const modulePath = toFileURL(commandFilePath);

            const importedObj = await import(`${modulePath}?t=${Date.now()}`);
            let commandObj: CommandFileObject = clone(importedObj); // Make commandObj extensible

            // If it's CommonJS, invalidate the import cache
            if (typeof module !== 'undefined' && typeof require !== 'undefined') {
                delete require.cache[require.resolve(commandFilePath)];
            }

            const compactFilePath = commandFilePath.split(process.cwd())[1] || commandFilePath;

            if (commandObj.default) commandObj = commandObj.default as CommandFileObject;

            // Ensure builder properties
            if (importedObj.default) {
                commandObj.data = importedObj.default.data;
            } else {
                commandObj.data = importedObj.data;
            }

            if (!commandObj.data) {
                console.log(
                    colors.yellow(
                        `⏩ Ignoring: Command ${compactFilePath} does not export "data".`,
                    ),
                );
                continue;
            }

            if (!commandObj.data.name) {
                console.log(
                    colors.yellow(
                        `⏩ Ignoring: Command ${compactFilePath} does not export "data.name".`,
                    ),
                );
                continue;
            }

            if (!commandObj.run) {
                console.log(
                    colors.yellow(
                        `⏩ Ignoring: Command ${commandObj.data.name} does not export "run".`,
                    ),
                );
                continue;
            }

            if (typeof commandObj.run !== 'function') {
                console.log(
                    colors.yellow(
                        `⏩ Ignoring: Command ${commandObj.data.name} does not export "run" as a function.`,
                    ),
                );
                continue;
            }

            commandObj.filePath = commandFilePath;

            let commandCategory =
                commandFilePath
                    .split(this.#data.commandsPath)[1]
                    ?.replace(/\\\\|\\/g, '/')
                    .split('/')[1] || null;

            if (commandCategory && allowedExtensions.test(commandCategory)) {
                commandObj.category = null;
            } else {
                commandObj.category = commandCategory;
            }

            this.#data.commands.push(commandObj);
        }
    }

    #buildValidations() {
        for (const validationFunction of builtInValidations) {
            this.#data.builtInValidations.push(validationFunction);
        }
    }

    handleCommands() {
        this.#data.client.on('interactionCreate', async (interaction) => {
            if (
                !interaction.isChatInputCommand() &&
                !interaction.isContextMenuCommand() &&
                !interaction.isAutocomplete()
            )
                return;

            const isAutocomplete = interaction.isAutocomplete();

            const targetCommand = this.#data.commands.find(
                (cmd) => cmd.data.name === interaction.commandName,
            );

            if (!targetCommand) {
                console.log(
                    colors.yellow(
                        `⏩ Ignoring: Command ${interaction.commandName} does not have a file`,
                    ),
                );
                return;
            }

            const { data, options, run, autocompleteRun, ...rest } = targetCommand;

            // skip if autocomplete handler is not defined
            if (isAutocomplete && !autocompleteRun) return;

            const commandObj = {
                data: targetCommand.data,
                options: targetCommand.options,
                ...rest,
            };

            if (this.#data.validationHandler) {
                let canRun = true;

                for (const validationFunction of this.#data.validationHandler.validations) {
                    const stopValidationLoop = await validationFunction({
                        interaction,
                        commandObj,
                        client: this.#data.client,
                        handler: this.#data.commandkitInstance,
                    });

                    if (stopValidationLoop) {
                        canRun = false;
                        break;
                    }
                }

                if (!canRun) return;
            }

            let canRun = true;

            // If custom validations pass and !skipBuiltInValidations, run built-in CommandKit validation functions
            if (!this.#data.skipBuiltInValidations) {
                for (const validation of this.#data.builtInValidations) {
                    const stopValidationLoop = validation({
                        targetCommand,
                        interaction,
                        handlerData: this.#data,
                    });

                    if (stopValidationLoop) {
                        canRun = false;
                        break;
                    }
                }
            }

            if (!canRun) return;

            const context = {
                interaction,
                client: this.#data.client,
                handler: this.#data.commandkitInstance,
            };

            await targetCommand[isAutocomplete ? 'autocompleteRun' : 'run']!(context);
        });
    }

    get commands() {
        return this.#data.commands;
    }

    async reloadCommands(type?: ReloadOptions) {
        this.#data.commands = [];

        // Rebuild commands tree
        await this.#buildCommands();

        if (this.#data.bulkRegister) {
            await loadCommandsWithRest({
                client: this.#data.client,
                devGuildIds: this.#data.devGuildIds,
                commands: this.#data.commands,
                reloading: true,
                type,
            });
        } else {
            await registerCommands({
                client: this.#data.client,
                devGuildIds: this.#data.devGuildIds,
                commands: this.#data.commands,
                reloading: true,
                type,
            });
        }
    }

    async useUpdatedValidations() {}
}
