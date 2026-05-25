# Scanner Engine Rules

This directory contains individual static analysis check modules for Terraform config files.

## Rule Structure

Each rule inherits from a base `Rule` class and specifies:
* `id` (e.g. `AWS_S3_PUBLIC`)
* `severity` (e.g. `CRITICAL`)
* `title`
* `description`
* `category`

Rules implement a `check(ast_node)` method returning a boolean/Finding object.
