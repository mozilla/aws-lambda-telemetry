# aws-lambda-telemetry
AWS lambda function used to index Telemetry files in SimpleDB

## Deploy to AWS
```bash
ansible-playbook ansible/deploy.yml -e '@ansible/envs/dev.yml' -i ansible/inventory
```
