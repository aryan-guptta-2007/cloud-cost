# Secure S3 Bucket
resource "aws_s3_bucket" "secure_bucket" {
  bucket = "sentra-secure-data-safe"
  acl    = "private"
}

# Secure Security Group (restricts SSH ingress)
resource "aws_security_group" "secure_sg" {
  name        = "secure-ssh"
  description = "Allows SSH access from internal CIDR only"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
}

# Secure IAM Policy (specifies actions and resources)
resource "aws_iam_policy" "secure_policy" {
  name        = "s3-read-policy"
  description = "Scoped read permissions policy for S3 bucket"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::sentra-secure-data-safe",
        "arn:aws:s3:::sentra-secure-data-safe/*"
      ]
    }
  ]
}
EOF
}

# Encrypted DB Instance
resource "aws_db_instance" "secure_db" {
  allocated_storage   = 20
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.micro"
  db_name             = "securedb"
  username            = "postgres"
  password            = "SuperSecretPass123"
  storage_encrypted   = true
  skip_final_snapshot = true
}
