#!/bin/bash
echo `date -I`.`git log --format='%ai' | awk '{print $1}' | sort | uniq | wc -l|sed 's/\s//g'`.`git log --format='%ai' | grep $(date -I) | wc -l|sed 's/\s//g'`
