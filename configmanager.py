from typing import Dict
import yaml
import os.path
from collections import namedtuple

# use a namedtuple to make the cache entries a little more clear
CacheEntry = namedtuple('CacheEntry', ['entry', 'mtime'])

class MarketConfig():
    '''this class manages configurations for market experiments
    
    it takes two types of config files: a "session config" text file which defines the configuration for an entire session and a "round config"
    YAML file which defines the configuration for a single round.

    the session config file is a simple text file which lists names of round configs. one round is run for each listed round config.
    these files can also optionally contain comments on lines starting with "#".
    
    the structure of the round config YAML files is complex. for a reference of all the required fields, just look at demo.yaml in configs/round_configs.
    '''

    SESSION_CONFIG_PATH = 'otree_visual_markets/configs/session_configs/'
    ROUND_CONFIG_PATH = 'otree_visual_markets/configs/round_configs/'

    # these dicts store serialized config data so we don't have to hit the disk every time
    # we want a config field. they map a config name to a tuple containing the config entry
    # and the time that config was last modified.
    # the modified time is used so that if a config is changed while oTree is running, the cache
    # is cleared and the new version of the config is retreived.
    session_config_cache: Dict[str, CacheEntry] = {}
    round_config_cache:   Dict[str, CacheEntry] = {}

    @staticmethod
    def _read_session_config_from_path(path):
        with open(path) as infile:
            lines = infile.read().splitlines()
        return [l.strip() for l in lines if l.strip() != '' and not l.startswith('#')]
    
    @classmethod
    def _get_session_config(cls, session_config_name):
        path = cls.SESSION_CONFIG_PATH + session_config_name
        try:
            mtime = os.path.getmtime(path)
        except OSError as e:
            raise ValueError(f'session config "{session_config_name}" not found"') from e

        if session_config_name not in cls.session_config_cache or cls.session_config_cache[session_config_name].mtime < mtime:
            entry = cls._read_session_config_from_path(path)
            cls.session_config_cache[session_config_name] = CacheEntry(entry=entry, mtime=mtime)
        return cls.session_config_cache[session_config_name].entry
    
    @classmethod
    def _get_round_config(cls, round_config_name):
        path = cls.ROUND_CONFIG_PATH + round_config_name
        try:
            mtime = os.path.getmtime(path)
        except OSError as e:
            raise ValueError(f'round config "{round_config_name}" not found"') from e

        if round_config_name not in cls.round_config_cache or cls.round_config_cache[round_config_name].mtime < mtime:
            with open(path) as infile:
                entry = yaml.safe_load(infile)
            cls.round_config_cache[round_config_name] = CacheEntry(entry=entry, mtime=mtime)
        return cls.round_config_cache[round_config_name].entry
    
    @classmethod
    def get(cls, session_config_name, round_number, id_in_group=None):
        '''get an MarketConfig object given a specific session config name and round number'''
        session_config = cls._get_session_config(session_config_name)
        num_rounds = len(session_config)
        if round_number > num_rounds:
            return cls(num_rounds, None, id_in_group)
        round_config_name = session_config[round_number-1]
        round_config = cls._get_round_config(round_config_name)
        return cls(num_rounds, round_config, id_in_group)

    def __init__(self, num_rounds, round_data, id_in_group):
        self.num_rounds = num_rounds
        self.round_data = round_data
        self.role = None
        if id_in_group is not None and 'role_assignments' in round_data and id_in_group <= len(round_data['role_assignments']):
            self.role = round_data['role_assignments'][id_in_group-1]
        
    def __getattr__(self, field):
        if self.role is not None and 'role_params' in self.round_data:
            role_params = self.round_data['role_params'][self.role]
            if field in role_params:
                return role_params[field]

        if field not in self.round_data:
            raise ValueError(f'invalid round config: field "{field}" is missing')

        return self.round_data[field]
