/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse } from '@azure/ms-rest-js';
import * as path from 'path';
import { IActionContext } from 'vscode-azureextensionui';
import { localize } from '../../localize';
import { feedUtils } from '../../utils/feedUtils';
import { nonNullProp } from '../../utils/nonNull';
import { requestUtils } from '../../utils/requestUtils';
import { ITemplates } from '../ITemplates';
import { parseScriptTemplates } from '../script/parseScriptTemplates';
import { ScriptTemplateProvider } from '../script/ScriptTemplateProvider';
import { TemplateType } from '../TemplateProviderBase';

/**
 * Describes templates output before it has been parsed
 */
interface IRawJavaTemplates {
    templates: object[];
}

/**
 * Java templates largely follow the same formatting as script templates, but they come from maven
 */
export class JavaTemplateProvider extends ScriptTemplateProvider {
    private static readonly FUNCTION_MAVEN_REPOSITORY_URL: string = "https://repo1.maven.org/maven2/com/microsoft/azure/azure-functions-maven-plugin/maven-metadata.xml";
    private static readonly FUNCTION_TEMPLATES_URL: string = "https://aka.ms/java-function-templates";
    private static readonly FUNCTION_TEMPLATES_BINDINGS_URL: string = "https://aka.ms/java-function-templates-bindings";
    private static readonly FUNCTION_TEMPLATES_RESOURCES_URL: string = "https://aka.ms/java-function-templates-resources";
    private static latestVersion: string | null;

    public templateType: TemplateType = TemplateType.Java;

    protected get backupSubpath(): string {
        return path.join('java', this.version);
    }

    public async getLatestTemplateVersion(context: IActionContext): Promise<string> {
        if (!JavaTemplateProvider.latestVersion) {
            const response: HttpOperationResponse = await requestUtils.sendRequestWithExtTimeout(context, { method: 'GET', url: JavaTemplateProvider.FUNCTION_MAVEN_REPOSITORY_URL });
            const metadate: string = nonNullProp(response, 'bodyAsText');
            const match: RegExpMatchArray | null = metadate.match(/<release>(.*)<\/release>/i);
            if (!match) {
                throw new Error(localize('failedToDetectPluginVersion', 'Failed to detect Azure Functions maven plugin version from maven repository.'));
            } else {
                JavaTemplateProvider.latestVersion = match[1].trim();
            }
        }
        return JavaTemplateProvider.latestVersion;
    }

    public async getLatestTemplates(context: IActionContext): Promise<ITemplates> {
        this._rawTemplates = (await feedUtils.getJsonFeed<IRawJavaTemplates>(context, JavaTemplateProvider.FUNCTION_TEMPLATES_URL)).templates;
        this._rawBindings = await feedUtils.getJsonFeed(context, JavaTemplateProvider.FUNCTION_TEMPLATES_BINDINGS_URL);
        this._rawResources = await feedUtils.getJsonFeed(context, JavaTemplateProvider.FUNCTION_TEMPLATES_RESOURCES_URL);
        return parseScriptTemplates(this._rawResources, this._rawTemplates, this._rawBindings);
    }

    /**
     * Unlike script where templates come from multiple sources (bundle vs non-bundle), java always gets templates from the same source (maven)
     */
    public includeTemplate(): boolean {
        return true;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async getCacheKeySuffix(): Promise<string> {
        return 'Java';
    }
}
