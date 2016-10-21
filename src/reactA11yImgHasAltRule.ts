import * as ts from 'typescript';
import * as Lint from 'tslint/lib/lint';

import { ExtendedMetadata } from './utils/ExtendedMetadata';
import {
    getAllAttributesFromJsxElement,
    getJsxAttributesFromJsxElement,
    getStringLiteral,
    isEmpty
} from './utils/JsxAttribute';
import { isJsxSpreadAttribute } from './utils/TypeGuard';

const ROLE_STRING: string = 'role';
const ALT_STRING: string = 'alt';

export function getFailureStringNoAlt(tagName: string): string {
    return `<${tagName}> elements must have an non-empty alt attribute or \
use empty alt attribute as well as role='presentation' for decorative/presentational images. \
A reference for the presentation role can be found at https://www.w3.org/TR/wai-aria/roles#presentation.`;
}

export function getFailureStringEmptyAltAndNotPresentationRole(tagName: string): string {
    return `The value of alt attribute in <${tagName}> tag is empty and role value is not presentation. \
Add more details in alt attribute or specify role attribute to equal 'presentation' when 'alt' attribute is empty.`;
}

/**
 * Enforces that img elements have alt text.
 */
export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: ExtendedMetadata = {
        ruleName: 'react-a11y-img-has-alt',
        type: 'maintainability',
        description: 'Enforce that an img element contains the non-empty alt attribute. ' +
        'For decorative images, using empty alt attribute and role="presentation".',
        options: 'string[]',
        optionExamples: ['true', '[true, ["Image"]]'],
        issueClass: 'Non-SDL',
        issueType: 'Warning',
        severity: 'Important',
        level: 'Opportunity for Excellence',
        group: 'Accessibility'
    };

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return sourceFile.languageVariant === ts.LanguageVariant.JSX
            ? this.applyWithWalker(new ImgHasAltWalker(sourceFile, this.getOptions()))
            : [];
    }
}

class ImgHasAltWalker extends Lint.RuleWalker {
    public visitJsxElement(node: ts.JsxElement): void {
        this.checkJsxOpeningElement(node.openingElement);
        super.visitJsxElement(node);
    }

    public visitJsxSelfClosingElement(node: ts.JsxSelfClosingElement): void {
        this.checkJsxOpeningElement(node);
        super.visitJsxSelfClosingElement(node);
    }

    private checkJsxOpeningElement(node: ts.JsxOpeningElement): void {
        // Tag name is sensitive on lowercase or uppercase, we shoudn't normalize tag names in this rule.
        const tagName: string = node.tagName.getText();
        const options: any[] = this.getOptions(); // tslint:disable-line:no-any

        // The additionalTagNames are specified by tslint config to check not only 'img' tag but also customized tag.
        // @example checking a customized component 'Image' which should require 'alt' attribute.
        const additionalTagNames: string[] = options.length > 1 ? options[1] : [];

        // The targetTagNames is the list of tag names we want to check.
        const targetTagNames: string[] = ['img'].concat(additionalTagNames);

        if (!tagName || targetTagNames.indexOf(tagName) === -1) {
            return;
        }

        // If element contains JsxSpreadElement in which there could possibly be alt attribute, don't check it.
        if (getAllAttributesFromJsxElement(node).some(isJsxSpreadAttribute)) {
            return;
        }

        const attributes: { [propName: string]: ts.JsxAttribute } = getJsxAttributesFromJsxElement(node);
        const altAttribute: ts.JsxAttribute = attributes[ALT_STRING];

        if (!altAttribute) {
            this.addFailure(this.createFailure(
                node.getStart(),
                node.getWidth(),
                getFailureStringNoAlt(tagName)
            ));
        } else {
            const roleAttribute: ts.JsxAttribute = attributes[ROLE_STRING];
            const roleAttributeValue: string = roleAttribute ? getStringLiteral(roleAttribute) : '';
            const isPresentationRole: boolean = !!roleAttributeValue.toLowerCase().match(/\bpresentation\b/);
            const isEmptyAlt: boolean = isEmpty(altAttribute) || getStringLiteral(altAttribute) === '';

            if (isEmptyAlt && !isPresentationRole) { // <img alt='' />
                this.addFailure(this.createFailure(
                    node.getStart(),
                    node.getWidth(),
                    getFailureStringEmptyAltAndNotPresentationRole(tagName)
                ));
            }
        }
    }
}
