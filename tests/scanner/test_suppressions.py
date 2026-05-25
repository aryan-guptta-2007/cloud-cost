import os
import sys
from datetime import datetime
import pytest

# Ensure parent directory is in path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from scanner_engine.parsers.ignore_parser import parse_ignore_annotations

def test_ignore_annotations_parser():
    """
    Verifies that the ignore annotations parser:
    1. Extracts Rule IDs and `-- reason` comments correctly.
    2. Respects 'expires=YYYY-MM-DD' dates (allows active, rejects expired).
    3. Restricts ignores to the immediate next block.
    """
    # 1. Test standard ignore with reason
    hcl_content = (
        '# sentra-ignore: AWS_S3_PUBLIC -- Required for public CDN assets\n'
        'resource "aws_s3_bucket" "cdn_bucket" {\n'
        '  bucket = "my-cdn"\n'
        '  acl    = "public-read"\n'
        '}\n'
    )
    ignores = parse_ignore_annotations(hcl_content)
    assert "aws_s3_bucket.cdn_bucket" in ignores
    assert "AWS_S3_PUBLIC" in ignores["aws_s3_bucket.cdn_bucket"]
    assert ignores["aws_s3_bucket.cdn_bucket"]["AWS_S3_PUBLIC"] == "Required for public CDN assets"
    
    # 2. Test future expiration date (active suppression)
    hcl_not_expired = (
        '// sentra-ignore: AWS_SG_OPEN expires=2030-01-01 -- temporary exception\n'
        'resource "aws_security_group" "temp_sg" {\n'
        '  name = "temp-ssh"\n'
        '}\n'
    )
    ignores_future = parse_ignore_annotations(hcl_not_expired)
    assert "aws_security_group.temp_sg" in ignores_future
    assert "AWS_SG_OPEN" in ignores_future["aws_security_group.temp_sg"]
    assert ignores_future["aws_security_group.temp_sg"]["AWS_SG_OPEN"] == "temporary exception"
    
    # 3. Test past expiration date (expired suppression - findings should trigger)
    hcl_expired = (
        '# sentra-ignore: AWS_SG_OPEN expires=2020-01-01 -- old exception\n'
        'resource "aws_security_group" "expired_sg" {\n'
        '  name = "old-ssh"\n'
        '}\n'
    )
    ignores_past = parse_ignore_annotations(hcl_expired)
    # Should not be present since the expiration has passed
    assert "aws_security_group.expired_sg" not in ignores_past
    
    # 4. Test target block mapping rules (applies to next block even with spacers)
    hcl_distant = (
        '# sentra-ignore: AWS_S3_PUBLIC -- cdn asset\n'
        '\n'
        '# Some intermediate spacer comment\n'
        '\n'
        'resource "aws_s3_bucket" "other_bucket" {\n'
        '  acl = "public-read"\n'
        '}\n'
    )
    ignores_distant = parse_ignore_annotations(hcl_distant)
    assert "aws_s3_bucket.other_bucket" in ignores_distant
    assert ignores_distant["aws_s3_bucket.other_bucket"]["AWS_S3_PUBLIC"] == "cdn asset"

    # 5. Test search interruption (new ignore comments abort previous search)
    hcl_stop = (
        '# sentra-ignore: AWS_S3_PUBLIC -- reason1\n'
        '# sentra-ignore: AWS_SG_OPEN -- reason2\n'
        'resource "aws_security_group" "sg" {\n'
        '  name = "ssh"\n'
        '}\n'
    )
    ignores_stop = parse_ignore_annotations(hcl_stop)
    assert "aws_security_group.sg" in ignores_stop
    assert "AWS_SG_OPEN" in ignores_stop["aws_security_group.sg"]
    # AWS_S3_PUBLIC is disconnected from the block due to the intervening ignore statement
    assert "AWS_S3_PUBLIC" not in ignores_stop["aws_security_group.sg"]
