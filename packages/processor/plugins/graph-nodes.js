"use strict";

const selector = require("postcss-selector-parser");

const parser  = require("../parsers/parser.js");

const plugin = "modular-css-graph-nodes";

module.exports = (css, result) => {
    let current;

    const parse = (rule, value) => {
        const { opts } = result;
        let parsed;

        try {
            parsed = parser.parse(value);
        } catch(e) {
            throw rule.error(e.toString(), {
                word : value.substring(e.location.start.offset, e.location.end.offset),
            });
        }

        if(!parsed.source) {
            return;
        }

        const dependency = opts.resolve(opts.from, parsed.source);

        if(!dependency) {
            throw rule.error(
                `Unable to locate "${parsed.source}" from "${opts.from}"`,
                { word : parsed.source }
            );
        }

        result.messages.push({
            type : "modular-css",

            plugin,
            dependency,
        });
    };
    
    const externals = selector((selectors) =>
        selectors.walkPseudos(({ value, nodes }) => {
            // Need to ensure we only process :external pseudos, see #261
            if(value !== ":external") {
                return;
            }
            
            parse(current, nodes.toString());
        })
    );
    
    // @value <value> from <file>
    css.walkAtRules("value", (rule) => parse(rule, rule.params));

    // { composes: <rule> from <file> }
    css.walkDecls("composes", (rule) => parse(rule, rule.value));

    // :external(<rule> from <file>) { ... }
    // Have to assign to current so postcss-selector-parser can reference the right thing
    // in errors
    css.walkRules(/:external/, (rule) => {
        current = rule;
        
        externals.processSync(rule);
    });
};

module.exports.postcssPlugin = plugin;
