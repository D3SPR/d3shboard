import type { CompNode } from "./types";

/** A node's place in the tree: "0.children.2" style paths would be fiddly, so paths are index arrays. */
export type NodePath = number[];

export const samePath = (a: NodePath, b: NodePath) => a.length === b.length && a.every((n, i) => n === b[i]);

export const isInside = (parent: NodePath, child: NodePath) =>
  parent.length < child.length && parent.every((n, i) => n === child[i]);

const childrenOf = (node: CompNode): CompNode[] =>
  node.kind === "stack" ? node.children : node.kind === "repeat" ? [node.item] : node.kind === "if" ? [node.then, ...(node.else ? [node.else] : [])] : [];

const withChildren = (node: CompNode, children: CompNode[]): CompNode => {
  if (node.kind === "stack") return { ...node, children };
  if (node.kind === "repeat") return { ...node, item: children[0] ?? node.item };
  if (node.kind === "if") return { ...node, then: children[0] ?? node.then, else: children[1] ?? node.else };
  return node;
};

export function nodeAt(root: CompNode, path: NodePath): CompNode | null {
  let node: CompNode | null = root;
  for (const index of path) {
    if (!node) return null;
    node = childrenOf(node)[index] ?? null;
  }
  return node;
}

/** Returns a copy of the tree with the node at `path` replaced (null removes it). */
export function replaceAt(root: CompNode, path: NodePath, next: CompNode | null): CompNode {
  if (!path.length) return next ?? root;
  const [index, ...rest] = path;
  const children = childrenOf(root);
  const child = children[index];
  if (!child) return root;
  if (!rest.length) {
    if (next) return withChildren(root, children.map((c, i) => (i === index ? next : c)));
    // Repeats and conditions always need their one child, so removal only applies inside stacks.
    if (root.kind !== "stack") return root;
    return withChildren(root, children.filter((_, i) => i !== index));
  }
  return withChildren(root, children.map((c, i) => (i === index ? replaceAt(child, rest, next) : c)));
}

/** Moves a child inside its own stack. */
export function moveAt(root: CompNode, path: NodePath, dir: -1 | 1): { tree: CompNode; path: NodePath } {
  if (!path.length) return { tree: root, path };
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const parent = nodeAt(root, parentPath);
  if (!parent || parent.kind !== "stack") return { tree: root, path };
  const target = index + dir;
  if (target < 0 || target >= parent.children.length) return { tree: root, path };
  const children = [...parent.children];
  [children[index], children[target]] = [children[target], children[index]];
  return { tree: replaceAt(root, parentPath, { ...parent, children }), path: [...parentPath, target] };
}

/** Adds a node inside the nearest stack at or above `path`. */
export function insertNear(root: CompNode, path: NodePath, node: CompNode): { tree: CompNode; path: NodePath } {
  const selected = nodeAt(root, path);
  if (selected?.kind === "stack") {
    const children = [...selected.children, node];
    return { tree: replaceAt(root, path, { ...selected, children }), path: [...path, children.length - 1] };
  }
  const parentPath = path.slice(0, -1);
  const parent = nodeAt(root, parentPath);
  if (parent?.kind === "stack") {
    const at = path[path.length - 1] + 1;
    const children = [...parent.children];
    children.splice(at, 0, node);
    return { tree: replaceAt(root, parentPath, { ...parent, children }), path: [...parentPath, at] };
  }
  if (root.kind === "stack") {
    const children = [...root.children, node];
    return { tree: { ...root, children }, path: [children.length - 1] };
  }
  // The root isn't a stack: wrap it so there's somewhere to put things.
  return { tree: { kind: "stack", dir: "col", gap: 0.4, children: [root, node] }, path: [1] };
}

/** A readable one-line description of a node, for the outline. */
export function describeNode(node: CompNode): string {
  switch (node.kind) {
    case "stack":
      return node.dir === "row" ? "Row" : "Column";
    case "text":
      return typeof node.value === "string" ? `“${node.value}”` : "param" in node.value ? `Setting: ${node.value.param}` : `Text: ${node.value.path}`;
    case "icon":
      return typeof node.value === "string" ? `Icon: ${node.value}` : "Icon from data";
    case "image":
      return "Picture";
    case "bar":
      return "Bar";
    case "divider":
      return "Line";
    case "spacer":
      return "Gap";
    case "repeat":
      return `Repeat: ${node.list.path}`;
    case "if":
      return "Only if…";
    default:
      return "Piece";
  }
}

export const NEW_NODES: { label: string; hint: string; make: () => CompNode }[] = [
  { label: "Text", hint: "Words, or a value from your data.", make: () => ({ kind: "text", value: "Text", size: "md" }) },
  { label: "Row", hint: "Puts things side by side.", make: () => ({ kind: "stack", dir: "row", gap: 0.4, children: [] }) },
  { label: "Column", hint: "Stacks things top to bottom.", make: () => ({ kind: "stack", dir: "col", gap: 0.4, children: [] }) },
  { label: "Icon", hint: "A small symbol.", make: () => ({ kind: "icon", value: "sun", size: "lg", color: "accent" }) },
  { label: "Picture", hint: "An image from your data.", make: () => ({ kind: "image", value: "", size: 2 }) },
  { label: "Bar", hint: "A filled bar showing a number.", make: () => ({ kind: "bar", value: "50", max: "100", color: "accent" }) },
  { label: "Line", hint: "A thin dividing line.", make: () => ({ kind: "divider" }) },
  { label: "Gap", hint: "Pushes things apart.", make: () => ({ kind: "spacer" }) },
  {
    label: "Repeating list",
    hint: "One row for each headline, game or day.",
    make: () => ({ kind: "repeat", list: { bind: "", path: "" }, limit: "5", gap: 0.5, item: { kind: "text", value: { bind: "@item", path: "title" }, size: "sm" } }),
  },
];
