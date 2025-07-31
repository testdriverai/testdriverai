import json
import yaml
from jsonschema import validate, ValidationError

try:
    # Load the schema
    with open('schema.json', 'r') as f:
        schema = json.load(f)

    # Load the YAML data
    with open('data.yaml', 'r') as f:
        data = yaml.safe_load(f)

    # Validate
    validate(instance=data, schema=schema)
    print("Validation succeeded.")

except FileNotFoundError as e:
    print(f"Error: {e.filename} not found.")
except (json.JSONDecodeError, yaml.YAMLError) as e:
    print(f"Error decoding file: {e}")
except ValidationError as e:
    print("Validation failed, as expected:")
    # Print a user-friendly error message
    if e.validator == 'required':
        print(f"  - Missing required property: '{e.message.split("'")[1]}'")
    else:
        print(f"  - {e.message}")

    if e.path:
        print(f"  - Location: {list(e.path)}")

except Exception as e:
    print(f"An unexpected error occurred: {e}")
