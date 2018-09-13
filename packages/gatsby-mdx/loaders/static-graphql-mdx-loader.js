/**
 * Loader for making MDX queried via StaticQuery work.
 *
 * For the next step in rendering from MDX node, see mdx-renderer.js
 */
const crypto = require("crypto");
const { graphql } = global;
const { getOptions } = require("loader-utils");
const { uniqBy } = require("lodash");
const findScopes = require("../utils/find-scopes");

module.exports = async function(content) {
  const callback = this.async();
  const { store } = getOptions(this);
  const file = this.resourcePath;

  const staticQueryComponents = [
    ...store.getState().staticQueryComponents.values()
  ];

  const foundComponent = staticQueryComponents.find(
    component => component.componentPath === file
  );

  if (!foundComponent) {
    return callback(null, content);
  }

  // TODO: add check here for if query is looking for mdx.code

  const result = await graphql(foundComponent.query);
  const scopes = uniqBy(findScopes(result.data), "id");

  // if we have no mdx scopes, move on
  if (scopes.length === 0) {
    return callback(null, content);
  }

  const scopesImports = scopes
    .map(({ id, location }) => `import ${id} from "${location}";`)
    .join("\n");

  const mdxScopes = `{${scopes.map(({ id }) => id).join(", ")}}`;

  const OriginalComponentId = `OriginalComponent_${crypto
    .createHash(`md5`)
    .update(mdxScopes)
    .digest(`hex`)}`;

  const code = `${scopesImports}
import { MDXScopeProvider } from "gatsby-mdx/context";

${content.replace("export default ", `const ${OriginalComponentId} = `)}

export default ({children, ...props}) => <MDXScopeProvider scopes={${mdxScopes}}>
  <${OriginalComponentId} {...props}>
    {children}
  </${OriginalComponentId}>
</MDXScopeProvider>`;

  return callback(null, code);
};
