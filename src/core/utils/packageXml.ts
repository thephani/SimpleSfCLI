import xmlbuilder from 'xmlbuilder';
import { DEFAULT_API_VERSION } from '../../constants/metadata';

export function buildPackageXml(membersByType: Record<string, string[]>, apiVersion = DEFAULT_API_VERSION): string {
  const packageXml = xmlbuilder.create('Package', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

  Object.entries(membersByType)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, members]) => {
      if (!members.length) {
        return;
      }

      const typesNode = packageXml.ele('types');
      [...new Set(members)].sort().forEach((member) => {
        typesNode.ele('members', member);
      });
      typesNode.ele('name', type);
    });

  packageXml.ele('version', apiVersion);
  return packageXml.end({ pretty: true }) + '\n';
}

export function buildEmptyPackageXml(apiVersion = DEFAULT_API_VERSION): string {
  return buildPackageXml({}, apiVersion);
}
