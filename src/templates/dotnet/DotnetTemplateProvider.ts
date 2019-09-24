/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import { IActionContext } from 'vscode-azureextensionui';
import { ProjectRuntime } from '../constants';
import { ext } from '../extensionVariables';
import { downloadFile } from '../utils/fs';
import { cliFeedJsonResponse } from '../utils/getCliFeedJson';
import { executeDotnetTemplateCommand, getDotnetItemTemplatePath, getDotnetProjectTemplatePath, getDotnetTemplatesPath } from './executeDotnetTemplateCommand';
import { IFunctionTemplate } from './IFunctionTemplate';
import { parseDotnetTemplates } from './parseDotnetTemplates';
import { TemplateRetriever, TemplateType } from './TemplateRetriever';

export class DotnetTemplateRetriever extends TemplateRetriever {
    public templateType: TemplateType = TemplateType.Dotnet;
    private readonly _dotnetTemplatesKey: string = 'DotnetTemplates';
    private _rawTemplates: object[];

    protected async getTemplatesFromCache(runtime: ProjectRuntime): Promise<IFunctionTemplate[] | undefined> {
        const projectFilePath: string = getDotnetProjectTemplatePath(runtime);
        const itemFilePath: string = getDotnetItemTemplatePath(runtime);
        if (!await fse.pathExists(projectFilePath) || !await fse.pathExists(itemFilePath)) {
            return undefined;
        }

        const cachedDotnetTemplates: object[] | undefined = ext.context.globalState.get<object[]>(this.getCacheKey(this._dotnetTemplatesKey, runtime));
        if (cachedDotnetTemplates) {
            return parseDotnetTemplates(cachedDotnetTemplates, runtime);
        } else {
            return undefined;
        }
    }

    protected async getTemplatesFromCliFeed(cliFeedJson: cliFeedJsonResponse, templateVersion: string, runtime: ProjectRuntime, _context: IActionContext): Promise<IFunctionTemplate[]> {
        const projectFilePath: string = getDotnetProjectTemplatePath(runtime);
        await downloadFile(cliFeedJson.releases[templateVersion].projectTemplates, projectFilePath);

        const itemFilePath: string = getDotnetItemTemplatePath(runtime);
        await downloadFile(cliFeedJson.releases[templateVersion].itemTemplates, itemFilePath);

        return await this.parseTemplates(runtime);
    }

    protected async getTemplatesFromBackup(runtime: ProjectRuntime): Promise<IFunctionTemplate[]> {
        await fse.copy(ext.context.asAbsolutePath(path.join('resources', 'backupDotnetTemplates')), getDotnetTemplatesPath(), { overwrite: true, recursive: false });
        return await this.parseTemplates(runtime);
    }

    protected async cacheTemplates(runtime: ProjectRuntime): Promise<void> {
        ext.context.globalState.update(this.getCacheKey(this._dotnetTemplatesKey, runtime), this._rawTemplates);
    }

    private async parseTemplates(runtime: ProjectRuntime): Promise<IFunctionTemplate[]> {
        this._rawTemplates = <object[]>JSON.parse(await executeDotnetTemplateCommand(runtime, undefined, 'list'));
        return parseDotnetTemplates(this._rawTemplates, runtime);
    }
}