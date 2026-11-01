/**
 * Strict Schema Validation Engine
 * Enforces explicit schemas (type, required, length, format, allowedValues)
 * and strictly rejects unexpected extra fields with clear, actionable HTTP 400 errors.
 */

const FORMATS = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  datetime: {
    test: (val) => {
      if (typeof val !== 'string' || val.length < 10 || val.length > 35) return false;
      return !isNaN(Date.parse(val));
    }
  },
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[\d\s()-]{7,25}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  alphanumeric: /^[a-zA-Z0-9_-]+$/,
};

/**
 * Validate a single value against a field definition.
 * Returns null if valid, or an error string if invalid.
 */
function validateFieldValue(value, fieldName, fieldDef) {
  // If undefined or null:
  if (value === undefined || value === null || value === '') {
    if (fieldDef.required) {
      return `Field "${fieldName}" is required and cannot be empty.`;
    }
    return null; // optional & omitted is valid
  }

  // Type check
  switch (fieldDef.type) {
    case 'string': {
      if (typeof value !== 'string') {
        return `Field "${fieldName}" must be a string (received ${typeof value}).`;
      }
      const trimmed = value.trim();
      if (fieldDef.required && trimmed.length === 0) {
        return `Field "${fieldName}" cannot be blank.`;
      }
      if (fieldDef.minLength !== undefined && trimmed.length < fieldDef.minLength) {
        return `Field "${fieldName}" must be at least ${fieldDef.minLength} character(s) long.`;
      }
      if (fieldDef.maxLength !== undefined && trimmed.length > fieldDef.maxLength) {
        return `Field "${fieldName}" must not exceed ${fieldDef.maxLength} characters.`;
      }
      if (fieldDef.format && FORMATS[fieldDef.format]) {
        if (!FORMATS[fieldDef.format].test(trimmed)) {
          return `Field "${fieldName}" must match the format "${fieldDef.format}".`;
        }
      }
      if (fieldDef.allowedValues && Array.isArray(fieldDef.allowedValues)) {
        if (!fieldDef.allowedValues.includes(trimmed.toLowerCase()) && !fieldDef.allowedValues.includes(trimmed)) {
          return `Field "${fieldName}" must be one of: [${fieldDef.allowedValues.join(', ')}]. Received "${trimmed}".`;
        }
      }
      break;
    }

    case 'number':
    case 'float': {
      const num = Number(value);
      if (isNaN(num) || typeof value === 'boolean') {
        return `Field "${fieldName}" must be a valid number.`;
      }
      if (fieldDef.min !== undefined && num < fieldDef.min) {
        return `Field "${fieldName}" must be greater than or equal to ${fieldDef.min}.`;
      }
      if (fieldDef.max !== undefined && num > fieldDef.max) {
        return `Field "${fieldName}" must be less than or equal to ${fieldDef.max}.`;
      }
      break;
    }

    case 'integer': {
      const num = Number(value);
      if (isNaN(num) || !Number.isInteger(num) || typeof value === 'boolean') {
        return `Field "${fieldName}" must be an integer.`;
      }
      if (fieldDef.min !== undefined && num < fieldDef.min) {
        return `Field "${fieldName}" must be greater than or equal to ${fieldDef.min}.`;
      }
      if (fieldDef.max !== undefined && num > fieldDef.max) {
        return `Field "${fieldName}" must be less than or equal to ${fieldDef.max}.`;
      }
      break;
    }

    case 'boolean': {
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
        return `Field "${fieldName}" must be a boolean (true/false).`;
      }
      break;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        return `Field "${fieldName}" must be an array.`;
      }
      if (fieldDef.minItems !== undefined && value.length < fieldDef.minItems) {
        return `Field "${fieldName}" must contain at least ${fieldDef.minItems} item(s).`;
      }
      if (fieldDef.maxItems !== undefined && value.length > fieldDef.maxItems) {
        return `Field "${fieldName}" cannot contain more than ${fieldDef.maxItems} items.`;
      }
      if (fieldDef.items && typeof fieldDef.items === 'object') {
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (fieldDef.items.type === 'object' && fieldDef.items.properties) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
              return `Item at index ${i} in "${fieldName}" must be an object.`;
            }
            // Validate properties of array item
            for (const [propName, propDef] of Object.entries(fieldDef.items.properties)) {
              const propErr = validateFieldValue(item[propName], `${fieldName}[${i}].${propName}`, propDef);
              if (propErr) return propErr;
            }
          } else if (fieldDef.items.type === 'string' && typeof item !== 'string') {
            return `Item at index ${i} in "${fieldName}" must be a string.`;
          }
        }
      }
      break;
    }

    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `Field "${fieldName}" must be a valid JSON object.`;
      }
      if (fieldDef.properties && typeof fieldDef.properties === 'object') {
        for (const [propName, propDef] of Object.entries(fieldDef.properties)) {
          const propErr = validateFieldValue(value[propName], `${fieldName}.${propName}`, propDef);
          if (propErr) return propErr;
        }
      }
      break;
    }

    default:
      break;
  }

  return null;
}

/**
 * Creates Express middleware to validate req.body against a strict schema.
 * Rejects any unexpected/extra fields, missing required fields, or type/format mismatches.
 */
function validateSchema(schema = {}, options = { allowEmptyBody: false }) {
  const allowedKeys = new Set(Object.keys(schema));

  return (req, res, next) => {
    // If no body provided:
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      if (options.allowEmptyBody) {
        return next();
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid request payload: Request body must be a JSON object.',
        code: 'INVALID_PAYLOAD'
      });
    }

    const payloadKeys = Object.keys(req.body);

    // Check for empty body if not allowed and required fields exist
    const requiredKeys = Object.entries(schema)
      .filter(([_, def]) => def.required)
      .map(([key]) => key);

    if (payloadKeys.length === 0 && requiredKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Payload is empty. Required fields missing: [${requiredKeys.join(', ')}].`,
        code: 'EMPTY_PAYLOAD',
        requiredFields: requiredKeys
      });
    }

    // 1. Strict Extra Field Detection: Reject any key not in schema
    for (const key of payloadKeys) {
      if (!allowedKeys.has(key)) {
        return res.status(400).json({
          success: false,
          error: `Validation error: Unexpected field "${key}" is not permitted on this endpoint.`,
          field: key,
          code: 'UNEXPECTED_FIELD',
          allowedFields: Array.from(allowedKeys)
        });
      }
    }

    // 2. Validate all schema fields against definitions
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const err = validateFieldValue(req.body[fieldName], fieldName, fieldDef);
      if (err) {
        return res.status(400).json({
          success: false,
          error: `Validation error: ${err}`,
          field: fieldName,
          code: 'SCHEMA_VALIDATION_ERROR'
        });
      }
    }

    next();
  };
}

module.exports = {
  validateSchema,
  validateFieldValue
};
