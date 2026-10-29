export const VK_API_VERSION = "5.199";

export const VK_READ_ONLY_METHODS = Object.freeze({
  "utils.resolveScreenName": {
    token_types: ["service", "user", "group"],
    purpose: "Resolve community screen name to VK object ID"
  },
  "groups.getById": {
    token_types: ["service", "user", "group"],
    purpose: "Read community profile fields"
  },
  "groups.getAddresses": {
    token_types: ["service", "user"],
    purpose: "Read community addresses"
  },
  "wall.get": {
    token_types: ["service", "user"],
    purpose: "Read community wall posts"
  },
  "wall.getComments": {
    token_types: ["service", "user"],
    purpose: "Read public wall comments"
  },
  "market.get": {
    token_types: ["user"],
    purpose: "Read community market items"
  }
});

export function getReadOnlyMethodPolicy(method) {
  return VK_READ_ONLY_METHODS[method] || null;
}

export function assertReadOnlyVkMethod(method, tokenType) {
  const policy = getReadOnlyMethodPolicy(method);

  if (!policy) {
    throw new Error(`VK API method is not allowlisted: ${method}`);
  }

  if (!policy.token_types.includes(tokenType)) {
    throw new Error(
      `VK API token type ${tokenType} is not allowed for ${method}`
    );
  }

  return policy;
}
